"""
Shared tools for all agents: file I/O + ask_user.
Uses ContextVars to be session-aware without passing state explicitly.
"""

import asyncio
import contextvars
import os
from pathlib import Path

from dotenv import load_dotenv

# Loaded here (not just by each service's main.py) so WORKSPACE_BASE below sees .env's value
# regardless of module import order — main.py imports this module before calling load_dotenv()
# itself. load_dotenv() doesn't override already-set real env vars, so this is safe to repeat.
load_dotenv()

# Per-request context injected by agui.py before starting each run
_session_id: contextvars.ContextVar[str] = contextvars.ContextVar("session_id", default="")
_event_queue: contextvars.ContextVar[asyncio.Queue] = contextvars.ContextVar("event_queue")

WORKSPACE_BASE = Path(os.getenv("WORKSPACE_BASE", "/tmp/deep-analyst"))


def _workspace() -> Path:
    p = WORKSPACE_BASE / (_session_id.get() or "default")
    p.mkdir(parents=True, exist_ok=True)
    return p


def write_file(path: str, content: str) -> str:
    """Write content to a file in the research workspace. Use relative paths like 'research_notes/topic.md'."""
    target = _workspace() / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return f"Written {len(content)} chars to {path}"


def read_file(path: str) -> str:
    """Read a file from the research workspace."""
    target = _workspace() / path
    if not target.exists():
        # List what's available to help the agent
        ws = _workspace()
        available = [str(f.relative_to(ws)) for f in ws.rglob("*") if f.is_file()]
        hint = f"\nAvailable files: {available}" if available else ""
        return f"File not found: {path}{hint}"
    return target.read_text(encoding="utf-8")


def list_files(directory: str = ".") -> str:
    """List all files in the research workspace (or a subdirectory)."""
    target = _workspace() / directory
    if not target.exists():
        return f"Directory not found: {directory}"
    files = sorted(f.relative_to(_workspace()) for f in target.rglob("*") if f.is_file())
    return "\n".join(str(f) for f in files) if files else "No files found"


async def ask_user(question: str) -> str:
    """Pause and ask the user a clarifying question. Returns their answer."""
    try:
        q = _event_queue.get()
        await q.put(("interrupt", question))
    except LookupError:
        return ""

    from deep_analyst_shared.session import get_answer
    return await get_answer(_session_id.get(""))
