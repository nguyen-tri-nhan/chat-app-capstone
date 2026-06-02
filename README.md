# Deep Analyst — Agent-Transparent Chat Application

A chat application that gives users full visibility into what AI agents are doing in real time. Every thinking step, tool call, parallel execution, and agent handoff is rendered as it happens.

---

## Architecture

```
frontend/          React + TypeScript (Vite)
                   Chat UI · Trace Tree · Artifact Panel · AG-UI Protocol

agents/            Python (FastAPI + Google ADK)
  agents/          lead_analyst · web_researcher ×3 · data_analyst · report_writer
  prompts/         System prompts for each agent (Markdown)
```

**Stack:** Google ADK · AG-UI · OpenCode Zen (free LLM via LiteLLM) · FastAPI · React

**Agent flow:**

```
User → lead_analyst → [web_researcher ×3 in parallel] → data_analyst → report_writer → Report
```

---

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Node.js 18+ / npm

---

## Setup

**1. Clone**

```bash
git clone <repo-url>
cd chat-app-capstone
```

**2. Backend**

```bash
cd agents
uv sync
cp .env.example .env
# Fill in LLM_API_KEY in .env
```

Get a free API key at [opencode.ai/auth](https://opencode.ai/auth).

**3. Frontend**

```bash
cd frontend
npm install
```

---

## Run

```bash
# From project root
make be      # backend  → http://localhost:8000
make fe      # frontend → http://localhost:5173
```

Or separately:

```bash
cd agents   && uv run uvicorn main:app --reload --port 8000
cd frontend && npm run dev
```

### Verify backend is working

```bash
make verify
# Expected: Agent: Hello! ✓ Stack verified
```

---

## Environment Variables

`agents/.env`:

```env
LLM_BASE_URL=https://opencode.ai/zen/v1/
LLM_MODEL=opencode/deepseek-v4-flash-free
LLM_API_KEY=your_key_here
```

Available free models: `deepseek-v4-flash-free`, `big-pickle`, `mimo-v2.5-free`, `nemotron-3-super-free`

---

## Project Structure

```
chat-app-capstone/
├── Makefile
├── agents/
│   ├── main.py                  # FastAPI app + health endpoint
│   ├── agents/
│   │   ├── lead_analyst.py      # Orchestrator (CollaborativeWorkflow)
│   │   ├── web_researcher.py    # Web search agent (×3 instances)
│   │   ├── data_analyst.py      # Metrics extraction agent
│   │   ├── report_writer.py     # Final report synthesis agent
│   │   └── shared.py            # LLM config + prompt loader
│   ├── prompts/                 # System prompts (Markdown)
│   ├── pyproject.toml
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── components/          # ChatPanel, TraceTree, ArtifactPanel, ...
    │   ├── hooks/               # useAGUI.ts
    │   └── store/               # reducer.ts, types.ts
    └── package.json
```

---

## Known Limitations

- Web search requires Google Search API — may fall back to no results on free tier
- Free LLM models on OpenCode Zen may be slow for large research topics
- Session state is in-memory; restarting the server clears all sessions
- Parallel web researchers are capped at 3 subtopics per run
