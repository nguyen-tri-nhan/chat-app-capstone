import asyncio
import uuid
from dataclasses import dataclass, field


@dataclass
class Session:
    id: str
    user_id: str = "user"
    run_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    _answer_event: asyncio.Event = field(default_factory=asyncio.Event)
    _answer_value: str = ""


_sessions: dict[str, Session] = {}


def create_session() -> Session:
    s = Session(id=str(uuid.uuid4()))
    _sessions[s.id] = s
    return s


def get_session(session_id: str) -> Session | None:
    return _sessions.get(session_id)


async def get_answer(session_id: str) -> str:
    """Block until the user submits an answer for this session."""
    session = _sessions.get(session_id)
    if not session:
        return ""
    session._answer_event.clear()
    await session._answer_event.wait()
    return session._answer_value


def set_answer(session_id: str, answer: str) -> bool:
    session = _sessions.get(session_id)
    if not session:
        return False
    session._answer_value = answer
    session._answer_event.set()
    return True
