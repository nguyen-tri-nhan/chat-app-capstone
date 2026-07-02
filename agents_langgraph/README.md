# Deep Analyst — LangGraph engine

Feature-parity alternative backend to [`../agents`](../agents) (Google ADK). Implements the
same 4-phase research pipeline (extractor → parallel web_researcher×N → data_analyst →
report_writer) and emits the same AG-UI SSE event stream, so the existing frontend
(`../frontend`) works against either backend with zero frontend changes.

## Stack

- **Orchestration**: LangGraph `StateGraph`, with `Send()` fan-out for the parallel
  web-researcher phase (concurrency capped via `max_concurrency` on `.ainvoke()`, mirroring the
  ADK backend's `asyncio.Semaphore(5)`).
- **Model client**: `langchain-openai`'s `ChatOpenAI`, pointed at the same OpenCode Zen
  OpenAI-compatible endpoint as the ADK backend (`LLM_BASE_URL`/`LLM_MODEL`/`LLM_API_KEY`).
- **Agent loop**: hand-rolled OpenAI-style tool-calling loop (`pipeline.py::_run_agent_loop`),
  not LangGraph's `create_react_agent`/`astream_events()` — this is what reproduces the ADK
  backend's exact event granularity (`STEP_ACTIVE` re-asserted before every chunk, tool-call
  args emitted as one atomic post-hoc JSON blob) that the frontend's trace tree depends on.

## Setup

```bash
uv sync
cp .env.example .env   # fill in LLM_API_KEY
uv run uvicorn main:app --reload --port 8001
```

Or via the repo root `Makefile`: `make be-langgraph`.

## Known limitations

1. **`ask_user` interrupts are silently dropped.** This is inherited, not new: `agui.py`'s SSE
   consumer loop only branches on `"sse"`/`"done"` queue items, so the `("interrupt", question)`
   tuple that `tools.py::ask_user` puts on the queue is discarded and the run just hangs
   awaiting an answer the browser was never told to ask for. The ADK backend (`../agents`) has
   the identical gap — reproduced here intentionally for parity rather than fixed, since fixing
   it would make the two backends diverge. A fix (not implemented here) would add an
   `"interrupt"` branch to `agui.py`'s consumer loop that emits
   `CustomEvent(name="ASK_USER", value={"question": ...})`, which the frontend already knows how
   to render (`frontend/src/store/reducer.ts`'s `CUSTOM/ASK_USER` handler).
2. **Reasoning content may never appear.** The ADK backend's `REASONING_MESSAGE_CHUNK` events
   only exist because Gemini's SDK returns a distinct `thought` field. For an OpenAI-compatible
   endpoint, reasoning only surfaces if the model passes a `reasoning_content` delta through
   `additional_kwargs`, which depends on the specific free model configured on OpenCode Zen —
   unverified. If absent, the trace tree's reasoning panel simply stays empty for that agent;
   this is a harmless subset of the ADK backend's behavior, not an error.
3. **`WORKSPACE_BASE` is `/tmp/deep-analyst-langgraph`** (vs. the ADK backend's
   `/tmp/deep-analyst`), specifically so both backends can run side by side on one machine
   during local (non-Docker) development without artifact collisions.

## Testing

```bash
uv run pytest -v
```

Covers the FastAPI endpoints (no LLM calls) and the file tools. Like the ADK backend,
`pipeline.py` and the per-phase agent modules have no automated test coverage — exercising them
requires a live LLM call. Verify end-to-end by running a real research topic through the
browser against this backend (`VITE_API_BASE=http://localhost:8001`) and comparing the trace
tree/artifacts against the ADK backend's output for the same topic.
