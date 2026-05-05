"""
AGENTFORGE — Multi-Agent AI Workflow Automation
FastAPI orchestrator coordinating Planner / Researcher / Analyst agents.

The agents are implemented as a lightweight orchestration layer that conforms
to the CrewAI / AutoGen mental model (role-based agents with tool use, message
passing, shared memory) but doesn't require those heavy deps to be installed
on a free Render instance. The architecture maps 1:1 to CrewAI's Crew/Agent/Task
abstractions, so swapping in actual CrewAI is a drop-in replacement.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv

from models import (
    WorkflowRequest,
    WorkflowResponse,
    Workflow,
    WorkflowState,
    AgentEvent,
    AgentRole,
    Template,
)
from agents import AgentOrchestrator
from tools import TOOL_REGISTRY
from storage import WorkflowStore
from templates import WORKFLOW_TEMPLATES

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

# Ensure data directory exists
data_dir = Path(__file__).parent / "data"
data_dir.mkdir(parents=True, exist_ok=True)

workflow_store = WorkflowStore(data_dir / "workflows.json")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        workflow_store.load()
    except Exception as e:
        print(f"Warning: Failed to load workflows: {e}")
    yield
    try:
        workflow_store.save()
    except Exception as e:
        print(f"Warning: Failed to save workflows: {e}")


app = FastAPI(
    title="AGENTFORGE API",
    description="Multi-Agent AI Workflow Automation — Planner / Researcher / Analyst orchestration",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "AGENTFORGE",
        "version": "1.0.0",
        "status": "online",
        "model": GROQ_MODEL,
        "agents": ["planner", "researcher", "analyst"],
        "tools": list(TOOL_REGISTRY.keys()),
        "endpoints": [
            "POST /api/workflow/run",
            "POST /api/workflow/stream",
            "GET  /api/workflows",
            "GET  /api/workflows/{id}",
            "DELETE /api/workflows/{id}",
            "GET  /api/templates",
            "GET  /api/agents",
            "GET  /api/tools",
            "GET  /api/stats",
        ],
    }


@app.get("/api/agents")
async def list_agents():
    """Return the agent roster with role definitions, system prompts, and tools."""
    return {
        "agents": [
            {
                "role": "planner",
                "name": "ATLAS",
                "title": "Strategic Planner",
                "description": "Decomposes complex problems into ordered sub-tasks. Routes work to the right specialist agents.",
                "color": "#fbbf24",
                "icon": "compass",
                "tools": ["task_decomposition"],
                "system_prompt_excerpt": "You break complex problems into clear, ordered steps...",
            },
            {
                "role": "researcher",
                "name": "ORION",
                "title": "Information Gatherer",
                "description": "Fetches real-time data from external sources, verifies facts, gathers evidence.",
                "color": "#34d399",
                "icon": "telescope",
                "tools": ["web_search", "fetch_url", "knowledge_base"],
                "system_prompt_excerpt": "You gather accurate, current information from reliable sources...",
            },
            {
                "role": "analyst",
                "name": "VEGA",
                "title": "Insight Synthesizer",
                "description": "Synthesizes findings, identifies patterns, computes metrics, produces actionable recommendations.",
                "color": "#22d3ee",
                "icon": "chart",
                "tools": ["calculator", "compare", "summarize"],
                "system_prompt_excerpt": "You synthesize research into clear, actionable insights...",
            },
        ]
    }


@app.get("/api/tools")
async def list_tools():
    """Return all tools available to agents."""
    return {
        "tools": [
            {
                "id": tid,
                "name": tool.name,
                "description": tool.description,
                "category": tool.category,
                "available_to": tool.available_to,
            }
            for tid, tool in TOOL_REGISTRY.items()
        ]
    }


@app.get("/api/templates")
async def list_templates():
    return {"templates": [t.model_dump() for t in WORKFLOW_TEMPLATES]}


@app.post("/api/workflow/stream")
async def workflow_stream(req: WorkflowRequest):
    """
    Run a multi-agent workflow with live event streaming via SSE.

    Events emitted:
      • workflow_started        — workflow id, initial config
      • agent_thinking          — an agent is reasoning
      • agent_message           — an agent emitted a message
      • tool_call_started       — agent invoked a tool
      • tool_call_completed     — tool returned
      • agent_handoff           — work passed from one agent to another
      • memory_update           — shared memory was updated
      • workflow_completed      — final answer + metadata
      • workflow_error          — fatal error
    """
    if not req.objective.strip():
        raise HTTPException(status_code=400, detail="Objective is required")

    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY not configured. Add it to backend/.env",
        )

    workflow_id = req.workflow_id or f"wf_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
    started_at = int(time.time() * 1000)

    orchestrator = AgentOrchestrator(
        groq_api_key=GROQ_API_KEY,
        groq_model=GROQ_MODEL,
        objective=req.objective,
        context=req.context,
        agents_enabled=req.agents_enabled or ["planner", "researcher", "analyst"],
        max_iterations=req.max_iterations or 6,
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        def sse(event: str, data: dict) -> str:
            return f"event: {event}\ndata: {json.dumps(data)}\n\n"

        # Workflow start
        yield sse("workflow_started", {
            "workflow_id": workflow_id,
            "objective": req.objective,
            "agents": orchestrator.agent_roster(),
            "started_at": started_at,
        })

        events: list[AgentEvent] = []
        final_answer = None
        final_tokens = 0
        error_msg = None

        try:
            async for event in orchestrator.run():
                events.append(event)
                yield sse(event.kind, event.model_dump())
                # tiny pause so the UI can paint
                await asyncio.sleep(0.05)
            final_answer = orchestrator.final_answer
            final_tokens = orchestrator.total_tokens
        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}"
            yield sse("workflow_error", {"message": error_msg})

        ended_at = int(time.time() * 1000)
        elapsed_ms = ended_at - started_at

        # Persist
        workflow = Workflow(
            id=workflow_id,
            objective=req.objective,
            context=req.context,
            state=WorkflowState.completed if not error_msg else WorkflowState.failed,
            agents_enabled=req.agents_enabled or ["planner", "researcher", "analyst"],
            events=events,
            final_answer=final_answer or "",
            total_tokens=final_tokens,
            tokens_by_agent=orchestrator.tokens_by_agent,
            tool_calls_count=orchestrator.tool_calls_count,
            started_at=started_at,
            ended_at=ended_at,
            elapsed_ms=elapsed_ms,
            error=error_msg,
        )
        workflow_store.put(workflow)

        if not error_msg:
            yield sse("workflow_completed", {
                "workflow_id": workflow_id,
                "final_answer": final_answer,
                "total_tokens": final_tokens,
                "tokens_by_agent": orchestrator.tokens_by_agent,
                "tool_calls_count": orchestrator.tool_calls_count,
                "elapsed_ms": elapsed_ms,
                "ended_at": ended_at,
            })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.post("/api/workflow/run", response_model=WorkflowResponse)
async def workflow_run(req: WorkflowRequest):
    """Non-streaming variant — collect all events then return at once."""
    if not req.objective.strip():
        raise HTTPException(status_code=400, detail="Objective is required")
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")

    workflow_id = req.workflow_id or f"wf_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
    started_at = int(time.time() * 1000)
    orchestrator = AgentOrchestrator(
        groq_api_key=GROQ_API_KEY,
        groq_model=GROQ_MODEL,
        objective=req.objective,
        context=req.context,
        agents_enabled=req.agents_enabled or ["planner", "researcher", "analyst"],
        max_iterations=req.max_iterations or 6,
    )
    events: list[AgentEvent] = []
    async for ev in orchestrator.run():
        events.append(ev)
    ended_at = int(time.time() * 1000)
    workflow = Workflow(
        id=workflow_id,
        objective=req.objective,
        context=req.context,
        state=WorkflowState.completed,
        agents_enabled=req.agents_enabled or ["planner", "researcher", "analyst"],
        events=events,
        final_answer=orchestrator.final_answer or "",
        total_tokens=orchestrator.total_tokens,
        tokens_by_agent=orchestrator.tokens_by_agent,
        tool_calls_count=orchestrator.tool_calls_count,
        started_at=started_at,
        ended_at=ended_at,
        elapsed_ms=ended_at - started_at,
    )
    workflow_store.put(workflow)
    return WorkflowResponse(
        workflow_id=workflow.id,
        final_answer=workflow.final_answer,
        events=events,
        total_tokens=workflow.total_tokens,
        elapsed_ms=workflow.elapsed_ms,
    )


@app.get("/api/workflows")
async def list_workflows():
    workflows = workflow_store.list_all()
    workflows.sort(key=lambda w: w.started_at, reverse=True)
    summaries = [
        {
            "id": w.id,
            "objective": w.objective,
            "state": w.state,
            "started_at": w.started_at,
            "elapsed_ms": w.elapsed_ms,
            "total_tokens": w.total_tokens,
            "tool_calls_count": w.tool_calls_count,
            "agents_enabled": w.agents_enabled,
        }
        for w in workflows
    ]
    return {"workflows": summaries, "count": len(summaries)}


@app.get("/api/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    w = workflow_store.get(workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return w.model_dump()


@app.delete("/api/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str):
    if not workflow_store.delete(workflow_id):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"deleted": workflow_id}


@app.get("/api/stats")
async def get_stats():
    workflows = workflow_store.list_all()
    total_tokens = sum(w.total_tokens for w in workflows)
    total_tool_calls = sum(w.tool_calls_count for w in workflows)
    by_agent = {}
    for w in workflows:
        for agent, tk in (w.tokens_by_agent or {}).items():
            by_agent[agent] = by_agent.get(agent, 0) + tk
    avg_elapsed = (
        sum(w.elapsed_ms for w in workflows) / len(workflows) if workflows else 0
    )
    return {
        "total_workflows": len(workflows),
        "total_tokens": total_tokens,
        "total_tool_calls": total_tool_calls,
        "tokens_by_agent": by_agent,
        "avg_elapsed_ms": int(avg_elapsed),
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {str(exc)}"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
