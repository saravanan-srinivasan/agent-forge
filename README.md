# AGENTFORGE — Multi-Agent AI Workflow Automation

> Specialized AI agents — Planner, Researcher, Analyst — collaborate to decompose and solve complex business problems through coordinated reasoning workflows.

**Tech Stack:** `Python` · `FastAPI` · `CrewAI / AutoGen patterns` · `Groq LLM` · `REST APIs` · `React` · `Vite`

---

## What it does

You give the crew a business objective. Three agents collaborate to solve it:

| Agent | Role | Tools |
|---|---|---|
| **ATLAS** (Planner)    | Decomposes the problem into ordered tasks, routes work to specialists | task_decomposition |
| **ORION** (Researcher) | Fetches real-time data, gathers evidence, verifies facts             | web_search, fetch_url, knowledge_base |
| **VEGA** (Analyst)     | Synthesizes findings, computes metrics, produces final recommendation | calculator, compare, summarize |

The crew works through your problem step-by-step — and you watch it happen live: tool calls, message handoffs, memory updates, the works.

---

## Architecture

```
┌──────────────────┐     HTTPS / SSE    ┌──────────────────────┐    HTTPS    ┌─────────────┐
│  React Frontend  │◄──────────────────►│   FastAPI Backend    │◄───────────►│  Groq LLM   │
│  (Netlify)       │                    │   (Render)           │             │  (Llama 3.3)│
│                  │                    │                      │             └─────────────┘
│ • Network graph  │                    │ • CrewAI Agents      │                    
│ • Live transcript│                    │ • AutoGen Planner    │             ┌─────────────┐
│ • Telemetry      │                    │ • Shared memory      │◄───────────►│ DuckDuckGo  │
│ • Templates      │                    │ • SSE streaming      │             │ (web search)│
└──────────────────┘                    └──────────────────────┘             └─────────────┘
```

**The orchestrator uses both CrewAI and AutoGen, each for what they do best:**

- **AutoGen `ConversableAgent`** powers the Planner — single-turn JSON output, lean and fast
- **CrewAI `Agent` + `Task`** powers the Researcher and Analyst — clean tool wiring through CrewAI's `BaseTool` abstraction, automatic tool-call loops
- **Shared `Memory` dataclass** passes context between stages (plan → findings → final answer)
- **Both libraries point at the same Groq endpoint** via the OpenAI-compatible API, so a single API key drives the whole crew

---

## Quick Start (local dev)

### Prerequisites
- Python 3.10+
- Node.js 18+
- A free [Groq API key](https://console.groq.com/keys)

### 1. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate           # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env and paste your GROQ_API_KEY

uvicorn main:app --reload
```
Backend runs at `http://localhost:8000`. Swagger docs at `/docs`.

### 2. Frontend (in a new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

### 3. Try it
Click any template card (Market Analysis, Investment Thesis, etc.) → press `⌘↵` (or "EXECUTE CREW") → watch the crew run.

---

## Production Deploy

See `DEPLOYMENT.md` for the full step-by-step Render + Netlify guide. TL;DR:

1. Push to GitHub
2. Deploy backend → Render (free tier, Python runtime)
3. Deploy frontend → Netlify (env var `VITE_API_BASE` = your Render URL)
4. Lock down CORS via `ALLOWED_ORIGINS` env var

---

## Features

### Core
- **Three specialized agents** with distinct roles, system prompts, and curated tool sets
- **Live SSE streaming** of every event — thinking, tool calls, message handoffs
- **Shared memory** — agents read/write a central scratchpad, just like CrewAI
- **Tool calling** — JSON-envelope tool invocation, parsed and dispatched server-side
- **Real REST APIs** — DuckDuckGo for live web search, URL fetching, calculator, comparison, summarization
- **Workflow persistence** — every run saved to disk, fully replayable

### UX polish
- **Animated agent network** — hexagonal nodes, particle flow along edges as messages pass
- **Live transcript** — color-coded timeline of every event with collapsible tool results
- **Per-agent telemetry** — tokens used, tool calls made, contribution bars
- **Workflow templates** — Market analysis, Investment thesis, Product decision, GTM, Hiring
- **Crew toggles** — disable individual agents to see how the others adapt
- **Command palette (⌘K)** — fuzzy search every action
- **Archive view** — browse and replay any past workflow
- **Analytics dashboard** — aggregate stats across all runs
- **Fully responsive** — desktop layout, tablet layout, mobile bottom-tabs

### Keyboard shortcuts
| Shortcut | Action |
|---|---|
| `⌘K` | Command palette |
| `⌘↵` | Execute crew |
| `⌘H` | Open archive |
| `⌘D` | Analytics dashboard |
| `⌘⇧N` | New workflow |
| `ESC` | Cancel running workflow |

---

## API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/workflow/run`        | POST   | Run a workflow synchronously, return final answer |
| `/api/workflow/stream`     | POST   | Stream events live via SSE |
| `/api/workflows`           | GET    | List all saved workflows |
| `/api/workflows/{id}`      | GET    | Load a specific workflow |
| `/api/workflows/{id}`      | DELETE | Remove a workflow |
| `/api/agents`              | GET    | Agent roster with roles/tools |
| `/api/tools`               | GET    | All available tools |
| `/api/templates`           | GET    | Pre-built workflow templates |
| `/api/stats`               | GET    | Aggregate analytics |

Auto-generated Swagger UI: `/docs`.

---

## Project structure

```
agentforge/
├── backend/
│   ├── main.py            FastAPI app, all routes, SSE streaming
│   ├── agents.py          AgentOrchestrator, role definitions, tool-use loops
│   ├── tools.py           Tool registry (web_search, calculator, etc.)
│   ├── templates.py       Pre-built workflow templates
│   ├── models.py          Pydantic schemas
│   ├── storage.py         JSON-backed workflow persistence
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── AgentNetwork.jsx           — animated SVG agent graph
│   │   │   ├── ConversationTranscript.jsx — live event timeline
│   │   │   ├── ObjectiveComposer.jsx      — input form + templates
│   │   │   ├── ExecutionMetrics.jsx       — live telemetry panel
│   │   │   ├── AgentRoster.jsx            — crew sidebar
│   │   │   ├── HistoryDrawer.jsx          — past workflows
│   │   │   ├── StatsDashboard.jsx         — aggregate analytics
│   │   │   └── CommandPalette.jsx         — ⌘K palette
│   │   ├── utils/
│   │   │   ├── api.js                     — backend client + SSE helper
│   │   │   ├── agents.js                  — frontend agent metadata
│   │   │   └── markdown.jsx               — markdown renderer
│   │   ├── hooks/useMediaQuery.js         — responsive helper
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── netlify.toml
├── render.yaml
├── README.md
├── DEPLOYMENT.md
└── .gitignore
```

---

## Why this satisfies the project description

**"Multi-agent system where specialized agents (planner, researcher, analyst) dynamically collaborate to decompose and solve complex business problems through coordinated reasoning workflows"**
→ Three agents (ATLAS/ORION/VEGA), each with role-specific system prompts, that hand off work to one another via explicit handoff events. The Planner produces a structured task decomposition that drives downstream specialists.

**"Tool-calling and API integration capabilities enabling agents to fetch, process, and synthesize real-time data, transforming static LLM responses into actionable decision-making systems"**
→ Six tools across three categories: information (web_search, fetch_url, knowledge_base), computation (calculator), synthesis (compare, summarize). All callable from the LLM via JSON envelope. DuckDuckGo gives real live web data — no static answers.

**"Scalable orchestration framework with modular agent pipelines, memory handling, and execution tracking, enabling extensibility for enterprise-grade automation scenarios"**
→ The `AgentOrchestrator` class is modular by design (each agent is a separate runner method). Shared `Memory` dataclass for cross-agent state. Every event timestamped and persisted. Adding a new agent role = define a system prompt + add a runner — the framework handles wiring.

---

## License

MIT
