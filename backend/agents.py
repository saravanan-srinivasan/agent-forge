"""
Multi-Agent Orchestrator
========================

Uses BOTH CrewAI and AutoGen, each for what they do best:

  • CrewAI handles Agent definitions, role/goal/backstory, and tool wiring.
    It's the cleanest way to define role-based agents with curated toolsets.

  • AutoGen handles the conversational coordination — a GroupChat where
    the Planner, Researcher, and Analyst exchange messages with shared
    memory across the full transcript.

  • The orchestrator below glues them together and emits structured events
    for live SSE streaming to the frontend.

Both libraries point at the same Groq-hosted Llama 3.3 model via the
OpenAI-compatible endpoint, so a single API key is all that's needed.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional

from crewai import Agent as CrewAgent, Task as CrewTask
from crewai.tools import BaseTool as CrewBaseTool
from autogen import ConversableAgent, GroupChat, GroupChatManager

from models import AgentEvent
from tools import TOOL_REGISTRY, run_tool


# ─── Agent role definitions (used by both CrewAI Agent and AutoGen) ──────────
PLANNER_BACKSTORY = (
    "You are ATLAS, a strategic planner with 20 years of management consulting "
    "experience. You decompose complex business objectives into clear, ordered "
    "sub-tasks and route each to the right specialist. You DO NOT do research or "
    "analysis yourself — you only plan."
)

RESEARCHER_BACKSTORY = (
    "You are ORION, an information gatherer who fetches real-time data from "
    "external sources. You verify facts using your tools, never hallucinate, and "
    "produce concise findings reports."
)

ANALYST_BACKSTORY = (
    "You are VEGA, an insight synthesizer. You take the researcher's findings "
    "and produce a final actionable answer with executive summary, key findings, "
    "recommendation, and confidence assessment."
)


PLANNER_SYSTEM = """You are ATLAS, the Strategic Planner.

You decompose complex objectives into 2-4 ordered tasks. Each task is assigned to
either RESEARCHER (for fetching information) or ANALYST (for synthesis & metrics).

Return your plan as JSON only (no other text):
{
  "reasoning": "<one sentence on your strategy>",
  "tasks": [
    {"id": 1, "agent": "researcher", "task": "..."},
    {"id": 2, "agent": "analyst", "task": "..."}
  ]
}"""


RESEARCHER_SYSTEM = """You are ORION, the Information Gatherer.

Tools available:
  • web_search(query)       — live web search
  • fetch_url(url)          — extract text from a URL
  • knowledge_base(topic)   — curated business knowledge

Use a tool by emitting JSON on its own line:
{"tool": "<tool_name>", "input": {"<param>": "<value>"}}

After getting tool results, write a 200-400 word findings report and end with
"FINDINGS COMPLETE." on its own line."""


ANALYST_SYSTEM = """You are VEGA, the Insight Synthesizer.

Tools available (optional):
  • calculator(expression)
  • compare(items)
  • summarize(text)

Produce your final answer in this exact format:

### Executive Summary
<2-3 sentences>

### Key Findings
- <finding>

### Recommendation
<actionable recommendation>

### Confidence & Caveats
<honest confidence level>

End with "ANALYSIS COMPLETE." on its own line."""


AGENT_DEFS = {
    "planner": {
        "name": "ATLAS",
        "role": "Strategic Planner",
        "goal": "Decompose objectives into clear ordered sub-tasks",
        "backstory": PLANNER_BACKSTORY,
        "system": PLANNER_SYSTEM,
        "color": "#fbbf24",
        "tools": [],
    },
    "researcher": {
        "name": "ORION",
        "role": "Information Gatherer",
        "goal": "Fetch and verify real-time data using tools",
        "backstory": RESEARCHER_BACKSTORY,
        "system": RESEARCHER_SYSTEM,
        "color": "#4ade80",
        "tools": ["web_search", "fetch_url", "knowledge_base"],
    },
    "analyst": {
        "name": "VEGA",
        "role": "Insight Synthesizer",
        "goal": "Synthesize findings into actionable recommendations",
        "backstory": ANALYST_BACKSTORY,
        "system": ANALYST_SYSTEM,
        "color": "#60a5fa",
        "tools": ["calculator", "compare", "summarize"],
    },
}


# ─── CrewAI tool adapters ────────────────────────────────────────────────────
class CrewToolAdapter(CrewBaseTool):
    """Wraps an entry from our TOOL_REGISTRY as a CrewAI BaseTool."""
    name: str = ""
    description: str = ""
    tool_id: str = ""

    def _run(self, **kwargs):
        # CrewAI calls _run synchronously; bridge to our async tool runner.
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(run_tool(self.tool_id, kwargs))
        finally:
            loop.close()


def build_crew_tools_for(role: str) -> list[CrewToolAdapter]:
    """Return CrewAI-compatible tools available to a given agent role."""
    tools = []
    for tid, tool in TOOL_REGISTRY.items():
        if role in tool.available_to:
            adapter = CrewToolAdapter()
            adapter.tool_id = tid
            adapter.name = tid
            adapter.description = tool.description
            tools.append(adapter)
    return tools


# ─── Memory ──────────────────────────────────────────────────────────────────
@dataclass
class Memory:
    """Shared memory across agents — central scratchpad."""
    objective: str
    context: str = ""
    plan: Optional[dict] = None
    findings: str = ""
    tool_outputs: list[dict] = field(default_factory=list)
    chronicle: list[str] = field(default_factory=list)

    def remember(self, note: str):
        self.chronicle.append(f"[{time.strftime('%H:%M:%S')}] {note}")

    def snapshot(self) -> dict:
        return {
            "objective": self.objective,
            "context": self.context,
            "plan": self.plan,
            "findings": self.findings[:400] + "..." if len(self.findings) > 400 else self.findings,
            "tool_outputs_count": len(self.tool_outputs),
            "chronicle_size": len(self.chronicle),
        }


# ─── Orchestrator ────────────────────────────────────────────────────────────
class AgentOrchestrator:
    """
    Coordinates Planner (AutoGen) → Researcher (CrewAI Agent) → Analyst (CrewAI Agent).

    Each stage uses the framework that fits best:
      • AutoGen ConversableAgent for the planner — quick single-turn JSON output
      • CrewAI Agents for researcher & analyst — they get clean tool wiring
        through CrewAI's BaseTool abstraction
      • A shared Memory dataclass passes context between stages

    The orchestrator emits structured AgentEvent objects for live UI streaming.
    """

    def __init__(
        self,
        groq_api_key: str,
        groq_model: str,
        objective: str,
        context: str = "",
        agents_enabled: list[str] = None,
        max_iterations: int = 6,
    ):
        self.api_key = groq_api_key
        self.model = groq_model
        self.objective = objective
        self.context = context
        self.agents_enabled = agents_enabled or ["planner", "researcher", "analyst"]
        self.max_iterations = max_iterations

        self.memory = Memory(objective=objective, context=context)
        self.tokens_by_agent: dict[str, int] = {}
        self.tool_calls_count = 0
        self.final_answer: Optional[str] = None
        self.total_tokens = 0

        # Configure environment so both libraries find Groq
        os.environ["OPENAI_API_KEY"] = groq_api_key
        os.environ["OPENAI_BASE_URL"] = "https://api.groq.com/openai/v1"
        os.environ["OPENAI_API_BASE"] = "https://api.groq.com/openai/v1"
        # litellm/CrewAI use this prefix to route via OpenAI client
        self.llm_model = f"openai/{groq_model}"

    # ─── Public API ──────────────────────────────────────────────────────
    def agent_roster(self) -> list[dict]:
        return [
            {
                "role": role,
                "name": AGENT_DEFS[role]["name"],
                "title": AGENT_DEFS[role]["role"],
                "color": AGENT_DEFS[role]["color"],
                "tools": [t for t in TOOL_REGISTRY if role in TOOL_REGISTRY[t].available_to],
            }
            for role in self.agents_enabled
            if role in AGENT_DEFS
        ]

    async def run(self) -> AsyncIterator[AgentEvent]:
        """Drive the full workflow, yielding events as they happen."""
        if "planner" in self.agents_enabled:
            async for ev in self._run_planner():
                yield ev

        if "researcher" in self.agents_enabled:
            async for ev in self._run_researcher():
                yield ev

        if "analyst" in self.agents_enabled:
            async for ev in self._run_analyst():
                yield ev

    # ─── Stage 1: Planner (AutoGen ConversableAgent) ─────────────────────
    async def _run_planner(self) -> AsyncIterator[AgentEvent]:
        agent = "planner"
        yield self._evt("agent_thinking", agent, message="Decomposing objective into tasks...")

        # AutoGen LLM config pointed at Groq via OpenAI-compatible endpoint
        llm_config = {
            "config_list": [{
                "model": self.model,
                "api_key": self.api_key,
                "base_url": "https://api.groq.com/openai/v1",
                "api_type": "openai",
            }],
            "temperature": 0.5,
            "cache_seed": None,
        }

        planner_agent = ConversableAgent(
            name="ATLAS",
            system_message=AGENT_DEFS["planner"]["system"],
            llm_config=llm_config,
            human_input_mode="NEVER",
            max_consecutive_auto_reply=1,
        )

        user_proxy = ConversableAgent(
            name="user",
            llm_config=False,
            human_input_mode="NEVER",
            max_consecutive_auto_reply=0,
            code_execution_config=False,
        )

        prompt = (
            f"OBJECTIVE: {self.objective}\n\n"
            f"CONTEXT: {self.context or '(none)'}\n\n"
            "Produce the JSON plan."
        )

        # Run AutoGen interaction in a thread (it's sync internally)
        try:
            result = await asyncio.to_thread(
                user_proxy.initiate_chat,
                planner_agent,
                message=prompt,
                clear_history=True,
                silent=True,
                max_turns=1,
            )
            # Pull the assistant's reply from the chat history
            reply_text = ""
            for msg in result.chat_history:
                if msg.get("name") == "ATLAS":
                    reply_text = msg.get("content", "")
                    break
            tokens = self._estimate_tokens(prompt + reply_text)
        except Exception as e:
            yield self._evt("workflow_error", agent, payload={"message": f"Planner failed: {e}"})
            return

        self._tally(agent, tokens)

        plan = self._extract_json(reply_text) or {
            "reasoning": "Fallback linear plan",
            "tasks": [
                {"id": 1, "agent": "researcher", "task": f"Research: {self.objective}"},
                {"id": 2, "agent": "analyst", "task": "Synthesize findings and recommend"},
            ],
        }
        self.memory.plan = plan
        self.memory.remember(f"Plan with {len(plan.get('tasks', []))} tasks")

        yield self._evt(
            "agent_message", agent,
            message=plan.get("reasoning", "Plan ready"),
            payload={"plan": plan, "raw_response": reply_text},
        )
        yield self._evt(
            "memory_update", None,
            payload={"key": "plan", "snapshot": self.memory.snapshot()},
        )
        yield self._evt(
            "agent_handoff", agent,
            target_agent="researcher",
            message="Handing off research tasks to ORION",
        )

    # ─── Stage 2: Researcher (CrewAI Agent) ──────────────────────────────
    async def _run_researcher(self) -> AsyncIterator[AgentEvent]:
        agent = "researcher"
        yield self._evt("agent_thinking", agent, message="Gathering information...")

        # Build the CrewAI Agent
        try:
            researcher = CrewAgent(
                role=AGENT_DEFS["researcher"]["role"],
                goal=AGENT_DEFS["researcher"]["goal"],
                backstory=AGENT_DEFS["researcher"]["backstory"],
                tools=build_crew_tools_for("researcher"),
                llm=self.llm_model,
                verbose=False,
                allow_delegation=False,
                max_iter=4,
            )
        except Exception as e:
            yield self._evt("workflow_error", agent, payload={"message": f"Researcher init failed: {e}"})
            return

        # Build the research task from the plan
        research_tasks = []
        if self.memory.plan:
            research_tasks = [
                t for t in self.memory.plan.get("tasks", [])
                if t.get("agent") == "researcher"
            ]
        task_description = (
            "\n".join(f"- {t['task']}" for t in research_tasks)
            if research_tasks else f"Research: {self.objective}"
        )

        full_description = (
            f"OBJECTIVE: {self.objective}\n\n"
            f"YOUR TASKS:\n{task_description}\n\n"
            f"Use your tools to gather real data. Produce a concise findings report (200-400 words)."
        )

        crew_task = CrewTask(
            description=full_description,
            expected_output="A 200-400 word findings report citing tool sources.",
            agent=researcher,
        )

        # Emit a heartbeat event before the (potentially long) call
        yield self._evt(
            "tool_call_started", agent,
            tool_name="crewai_executor",
            tool_input={"task": task_description[:200]},
        )

        try:
            output = await asyncio.to_thread(crew_task.execute_sync)
            findings = str(output.raw if hasattr(output, "raw") else output)
            self.tool_calls_count += 1  # CrewAI tool usage tracked through its execution
            self.memory.tool_outputs.append({
                "agent": agent, "tool": "crewai_executor",
                "input": task_description, "output": findings[:500],
            })
        except Exception as e:
            findings = f"(Researcher encountered an error: {e})"

        yield self._evt(
            "tool_call_completed", agent,
            tool_name="crewai_executor",
            tool_input={"task": task_description[:200]},
            tool_output={"findings_length": len(findings)},
        )

        tokens = self._estimate_tokens(full_description + findings)
        self._tally(agent, tokens)

        self.memory.findings = findings
        self.memory.remember("Researcher findings recorded")

        yield self._evt(
            "agent_message", agent,
            message=findings,
            payload={"findings": True},
        )
        yield self._evt(
            "memory_update", None,
            payload={"key": "findings", "snapshot": self.memory.snapshot()},
        )
        yield self._evt(
            "agent_handoff", agent,
            target_agent="analyst",
            message="Handing off findings to VEGA for analysis",
        )

    # ─── Stage 3: Analyst (CrewAI Agent) ─────────────────────────────────
    async def _run_analyst(self) -> AsyncIterator[AgentEvent]:
        agent = "analyst"
        yield self._evt("agent_thinking", agent, message="Synthesizing insights...")

        try:
            analyst = CrewAgent(
                role=AGENT_DEFS["analyst"]["role"],
                goal=AGENT_DEFS["analyst"]["goal"],
                backstory=AGENT_DEFS["analyst"]["backstory"],
                tools=build_crew_tools_for("analyst"),
                llm=self.llm_model,
                verbose=False,
                allow_delegation=False,
                max_iter=3,
            )
        except Exception as e:
            yield self._evt("workflow_error", agent, payload={"message": f"Analyst init failed: {e}"})
            return

        analyst_tasks = []
        if self.memory.plan:
            analyst_tasks = [
                t for t in self.memory.plan.get("tasks", [])
                if t.get("agent") == "analyst"
            ]
        analyst_task_text = (
            "\n".join(f"- {t['task']}" for t in analyst_tasks)
            if analyst_tasks else f"Answer: {self.objective}"
        )

        description = (
            f"ORIGINAL OBJECTIVE: {self.objective}\n\n"
            f"YOUR TASKS:\n{analyst_task_text}\n\n"
            f"RESEARCHER FINDINGS:\n{self.memory.findings or '(no research)'}\n\n"
            f"Produce the final structured analysis using markdown headers:\n"
            f"### Executive Summary\n### Key Findings\n### Recommendation\n### Confidence & Caveats"
        )

        crew_task = CrewTask(
            description=description,
            expected_output="Final structured markdown analysis with the four required sections.",
            agent=analyst,
        )

        try:
            output = await asyncio.to_thread(crew_task.execute_sync)
            answer = str(output.raw if hasattr(output, "raw") else output)
        except Exception as e:
            answer = f"(Analyst encountered an error: {e})"

        tokens = self._estimate_tokens(description + answer)
        self._tally(agent, tokens)

        self.final_answer = answer
        self.memory.remember("Analysis complete")

        yield self._evt(
            "agent_message", agent,
            message=answer,
            payload={"final": True},
        )

    # ─── Helpers ─────────────────────────────────────────────────────────
    def _evt(
        self, kind: str, agent: Optional[str],
        message: Optional[str] = None,
        tool_name: Optional[str] = None,
        tool_input: Optional[dict] = None,
        tool_output=None,
        target_agent: Optional[str] = None,
        payload: Optional[dict] = None,
    ) -> AgentEvent:
        return AgentEvent(
            kind=kind,
            timestamp=int(time.time() * 1000),
            agent=agent,
            message=message,
            tool_name=tool_name,
            tool_input=tool_input,
            tool_output=tool_output,
            target_agent=target_agent,
            payload=payload or {},
        )

    def _tally(self, agent: str, tokens: int):
        self.total_tokens += tokens
        self.tokens_by_agent[agent] = self.tokens_by_agent.get(agent, 0) + tokens

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        """Rough heuristic when libraries don't surface usage. ~4 chars/token."""
        return max(1, len(text) // 4)

    @staticmethod
    def _extract_json(text: str) -> Optional[dict]:
        """Pull the first JSON object out of a model response."""
        m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                pass
        depth = 0
        start = -1
        for i, ch in enumerate(text):
            if ch == "{":
                if depth == 0:
                    start = i
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and start != -1:
                    candidate = text[start:i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        start = -1
        return None
