"""
In-memory session store. Interface is clean enough to swap Redis later.
"""

import uuid
from dataclasses import dataclass, field


@dataclass
class Session:
    id: str
    user_id: str = "user"
    run_id: str = field(default_factory=lambda: str(uuid.uuid4()))


_sessions: dict[str, Session] = {}


def create_session() -> Session:
    s = Session(id=str(uuid.uuid4()))
    _sessions[s.id] = s
    return s


def get_session(session_id: str) -> Session | None:
    return _sessions.get(session_id)
