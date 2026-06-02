"""Unit tests for session management."""

import asyncio

import pytest

from session import Session, _sessions, create_session, get_session, set_answer


@pytest.fixture(autouse=True)
def clear_sessions():
    _sessions.clear()
    yield
    _sessions.clear()


def test_create_session_returns_session():
    s = create_session()
    assert isinstance(s, Session)
    assert s.id
    assert s.user_id == "user"


def test_get_existing_session():
    s = create_session()
    found = get_session(s.id)
    assert found is s


def test_get_missing_session():
    assert get_session("nonexistent") is None


def test_multiple_sessions_independent():
    s1 = create_session()
    s2 = create_session()
    assert s1.id != s2.id
    assert get_session(s1.id) is s1
    assert get_session(s2.id) is s2


@pytest.mark.asyncio
async def test_set_answer_unblocks_get_answer():
    from session import get_answer
    s = create_session()

    async def answer_after_delay():
        await asyncio.sleep(0.05)
        set_answer(s.id, "my answer")

    asyncio.create_task(answer_after_delay())
    result = await asyncio.wait_for(get_answer(s.id), timeout=1.0)
    assert result == "my answer"


def test_set_answer_missing_session():
    ok = set_answer("bad-id", "anything")
    assert ok is False


def test_set_answer_existing_session():
    s = create_session()
    ok = set_answer(s.id, "yes")
    assert ok is True
