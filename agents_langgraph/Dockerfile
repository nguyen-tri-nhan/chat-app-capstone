# Build context is the repo root (see docker-compose.yml) — this member depends on the
# `shared` workspace member, so the whole workspace must be visible to `uv sync`.
FROM python:3.12-slim
WORKDIR /app

RUN pip install uv --quiet

COPY pyproject.toml uv.lock ./
COPY shared/ shared/
COPY agents/ agents/
COPY agents_langgraph/ agents_langgraph/

RUN uv sync --frozen --no-dev --package agents-langgraph

# Run the pre-built venv's binaries directly, not via `uv run` — `uv run` re-checks/reconciles
# the environment on every invocation, which would pull dev deps back in at container start
# despite the --no-dev build above (confirmed empirically: adds ~6 packages on first `uv run`).
ENV PATH="/app/.venv/bin:$PATH"
WORKDIR /app/agents_langgraph
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
