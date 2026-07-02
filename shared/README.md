# deep-analyst-shared

Framework-agnostic pieces shared by [`../agents`](../agents) (Google ADK) and
[`../agents_langgraph`](../agents_langgraph) (LangGraph) — the two implementations of the same
research pipeline. Neither engine's LLM/agent framework code lives here; only the parts with no
framework coupling:

- `tools.py` — `write_file`/`read_file`/`list_files`/`ask_user`, session-scoped via `contextvars`.
- `session.py` — in-memory session store + the blocking-`asyncio.Event` mechanism behind `ask_user`.
- `prompts.py` + `prompts/*.md` — system prompt loader and the prompt text itself.

Not a standalone service — installed as a workspace-local dependency of `agents`/
`agents_langgraph` via `uv`'s workspace mechanism (see the repo root `pyproject.toml`).
