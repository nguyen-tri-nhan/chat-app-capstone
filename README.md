# Deep Analyst — Agent-Transparent Chat Application

A chat application that gives users full transparency into what AI agents are doing in real time. Every thinking step, tool call, parallel execution, and agent handoff is rendered as it happens.

---

## Design

### Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Agent Framework | Google ADK | Agent lifecycle, tool execution |
| LLM Provider | OpenCode Zen via LiteLLM | Free model access (OpenAI-compatible) |
| Agent–UI Protocol | AG-UI | Standardised SSE event stream |
| Backend | FastAPI + Python 3.12 | Pipeline orchestration, SSE endpoint |
| Frontend | React + TypeScript (Vite) | Chat UI, trace tree, artifacts |
| Containerisation | Docker + Nginx | Production deployment |
| CI | GitHub Actions | pytest + vitest on every push |

### System Architecture

```mermaid
flowchart LR
    subgraph Browser
        Chat
        TraceTree["Trace Tree"]
        Artifacts
    end

    subgraph FastAPI
        API["/runs /answer /artifacts"]
        Pipeline["Pipeline\norchestrator"]
    end

    subgraph Agents["ADK Agents"]
        EX["extractor"]
        WR["web_researcher ×N\n⚡ parallel"]
        DA["data_analyst"]
        RW["report_writer"]
    end

    Browser -->|"AG-UI SSE"| API
    API --> Pipeline
    Pipeline --> EX --> WR --> DA --> RW
    Agents -->|"AG-UI events"| API
    Agents --> LLM["OpenCode Zen"]
```

### Key Flows

**Research run**

```mermaid
sequenceDiagram
    participant U as User
    participant E as extractor
    participant W as web_researcher ×N
    participant D as data_analyst
    participant R as report_writer

    U->>E: topic
    alt ambiguous
        E-->>U: ask_user
        U->>E: answer
    end
    E->>E: submit_subjects([...])
    par parallel
        E->>W: researcher_1
    and
        E->>W: researcher_2
    and
        E->>W: researcher_N
    end
    W->>D: all done
    D->>R: analysis ready
    R-->>U: 📄 artifact
```

**ask_user flow**

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend
    participant AG as Agent (tool)

    AG->>BE: ask_user("question") → queue
    BE->>FE: SSE: CUSTOM/ASK_USER
    Note over FE: overlay shown, stream stays open
    FE->>BE: POST /answer/:id
    BE->>AG: asyncio.Event.set()
    AG->>AG: tool returns answer, continues
    BE->>FE: SSE: events resume
```

---

## Architecture

```
frontend/          React + TypeScript (Vite)
                   Chat UI · Trace Tree · Artifact Panel · AG-UI Protocol

agents/            Python (FastAPI + custom pipeline)
  agents/          extractor · web_researcher ×N · data_analyst · report_writer
  prompts/         System prompts for each agent (Markdown)
  pipeline.py      Custom async orchestrator (true parallel via asyncio.gather)
```

**Stack:** Google ADK · AG-UI Protocol · OpenCode Zen (free LLM via LiteLLM) · FastAPI · React

### System Architecture

```mermaid
flowchart TD
    subgraph Browser
        CP["Chat Panel"]
        TT["Trace Tree\n(nested, expand/collapse)"]
        AP["Artifact Panel\n(view + download)"]
        IO["ask_user Overlay"]
    end

    subgraph FastAPI["FastAPI Backend"]
        API["/runs  /answer  /artifacts"]
        PL["Pipeline Orchestrator\nasyncio tasks"]
        EN["AG-UI Event Bridge\nSSE stream"]
    end

    subgraph Agents["Google ADK Agents"]
        EX["extractor"]
        WR["web_researcher ×N\n(parallel)"]
        DA["data_analyst"]
        RW["report_writer"]
    end

    LLM["OpenCode Zen\nfree LLM via LiteLLM"]

    Browser -->|"POST /runs\nPOST /answer"| API
    API -->|SSE stream| Browser
    API --> PL
    PL --> EX --> WR --> DA --> RW
    Agents -->|AG-UI events| EN --> API
    Agents -->|LiteLLM| LLM
```

### Pipeline Flow

```mermaid
sequenceDiagram
    participant U as User
    participant E as extractor
    participant W as web_researcher ×N
    participant D as data_analyst
    participant R as report_writer

    U->>E: research topic
    alt topic is ambiguous
        E-->>U: ask_user (stream paused)
        U->>E: answer
    end
    E->>E: submit_subjects([...])

    par parallel execution
        E->>W: researcher_1(subject_1)
    and
        E->>W: researcher_2(subject_2)
    and
        E->>W: researcher_N(subject_N)
    end
    W->>W: web_search + write_file

    W->>D: all researchers done
    D->>D: read_file + write analysis
    D->>R: analysis ready
    R->>R: read all + write final_report.md
    R-->>U: 📄 artifact available
```

Each phase emits AG-UI events streamed to the browser in real time.

---

## Prerequisites

- Python 3.12+ · [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Node.js 18+ · npm
- Docker + Docker Compose *(for production)*

---

## Local Development

**1. Clone**

```bash
git clone <repo-url>
cd chat-app-capstone
```

**2. Install dependencies**

```bash
make install
```

**3. Configure**

```bash
cp agents/.env.example agents/.env
# Fill in LLM_API_KEY
```

Get a free API key at [opencode.ai/auth](https://opencode.ai/auth).

**4. Run**

```bash
make be      # backend  → http://localhost:8000
make fe      # frontend → http://localhost:5173
```

---

## Docker

```bash
make docker-up    # build + start (detached)
make docker-down  # stop
```

App available at `http://localhost`.

Logs:
```bash
docker compose logs -f           # all
docker compose logs -f backend   # backend only
```

---

## Environment Variables

`agents/.env`:

```env
LLM_BASE_URL=https://opencode.ai/zen/v1/
LLM_MODEL=opencode/deepseek-v4-flash-free
LLM_API_KEY=your_key_here
```

Available free models on OpenCode Zen: `deepseek-v4-flash-free`, `big-pickle`, `mimo-v2.5-free`, `nemotron-3-super-free`

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/sessions` | Create session |
| `POST` | `/runs` | Start research run (AG-UI, SSE stream) |
| `POST` | `/answer/:id` | Submit ask_user answer |
| `GET` | `/artifacts/:id` | List generated files |
| `GET` | `/artifact/:id/:path` | Download a file |

---

## Project Structure

```
chat-app-capstone/
├── Makefile
├── docker-compose.yml
├── agents/
│   ├── main.py              # FastAPI app, endpoints, logging
│   ├── pipeline.py          # Custom async pipeline orchestrator
│   ├── agui.py              # AG-UI SSE bridge
│   ├── session.py           # In-memory session store
│   ├── logging_config.py    # Logging setup
│   ├── agents/
│   │   ├── extractor.py     # Extracts research subjects
│   │   ├── web_researcher.py # Web search + file write (parallel ×N)
│   │   ├── data_analyst.py  # Reads notes, writes analysis
│   │   ├── report_writer.py # Writes final report
│   │   ├── tools.py         # Shared tools: web_search, write_file, ask_user
│   │   └── shared.py        # LLM config + prompt loader
│   ├── prompts/             # System prompts (Markdown)
│   ├── Dockerfile
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── components/      # ChatPanel, TraceTree, ArtifactPanel, InterruptOverlay
    │   ├── hooks/           # useAGUI.ts (SSE consumer + mock mode)
    │   ├── store/           # reducer.ts, types.ts
    │   └── mock/            # agui-events.ts (pre-recorded mock stream)
    ├── tests/               # decoder.test.ts (14 unit tests)
    ├── nginx.conf
    └── Dockerfile
```

---

## Testing

```bash
make test    # run frontend decoder unit tests (14 tests)
```

Frontend can also run in mock mode (no backend needed):

```bash
make mock    # → http://localhost:5173 with pre-recorded events
```

---

## Known Limitations

- Web search uses DuckDuckGo Instant Answer API — factual topics return better results than niche queries
- Free LLM models on OpenCode Zen may be slow; large research (top 10) can take 2–5 minutes
- Session state is in-memory — restarting the server clears all sessions
- Parallel researchers capped at N=10; max 5 run concurrently (Semaphore) to respect rate limits
