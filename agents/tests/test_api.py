"""Integration tests for FastAPI endpoints (no LLM calls)."""

import pytest
from httpx import ASGITransport, AsyncClient

from main import app
from session import _sessions


@pytest.fixture(autouse=True)
def clear_sessions():
    _sessions.clear()
    yield
    _sessions.clear()


@pytest.fixture
def client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_health(client):
    async with client as c:
        r = await c.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_create_session(client):
    async with client as c:
        r = await c.post("/sessions")
    assert r.status_code == 200
    data = r.json()
    assert "session_id" in data
    assert len(data["session_id"]) > 0


@pytest.mark.asyncio
async def test_answer_unknown_session(client):
    async with client as c:
        r = await c.post("/answer/bad-id", json={"answer": "hi"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_list_artifacts_empty(client):
    async with client as c:
        r = await c.get("/artifacts/nonexistent-session")
    assert r.status_code == 200
    assert r.json() == {"files": []}


@pytest.mark.asyncio
async def test_artifact_not_found(client):
    async with client as c:
        r = await c.get("/artifact/nosession/no/file.md")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_runs_no_message(client):
    async with client as c:
        r = await c.post("/runs", json={
            "threadId": "t1", "runId": "r1",
            "state": None, "tools": [], "context": [], "forwardedProps": {},
            "messages": [],
        })
    assert r.status_code == 400
