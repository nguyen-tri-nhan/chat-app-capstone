import uuid
from contextlib import asynccontextmanager

from ag_ui.core import RunAgentInput
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from agents.tools import WORKSPACE_BASE
from agui import run_and_stream, sse_response
from logging_config import get_logger, setup_logging
from session import Session, create_session, get_session, set_answer

load_dotenv()
setup_logging()

log = get_logger("api")


@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info("Deep Analyst API (LangGraph) started")
    yield
    log.info("Deep Analyst API (LangGraph) shutting down")


app = FastAPI(title="Deep Analyst API (LangGraph)", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/sessions")
async def create_new_session() -> dict:
    session = create_session()
    log.info("Session created: %s", session.id)
    return {"session_id": session.id}


@app.post("/runs")
async def run_agent(body: RunAgentInput):
    thread_id = body.thread_id or ""
    session = get_session(thread_id)

    if not session:
        session = Session(id=thread_id or str(uuid.uuid4()), user_id="user")
        from session import _sessions
        _sessions[session.id] = session
        log.info("Auto-created session: %s", session.id)

    # Extract latest user message
    message = ""
    if body.messages:
        for msg in reversed(body.messages):
            if msg.role == "user":
                content = msg.content
                if isinstance(content, str):
                    message = content
                elif isinstance(content, list):
                    for block in content:
                        if hasattr(block, "text"):
                            message = block.text
                            break
            if message:
                break

    if not message:
        raise HTTPException(status_code=400, detail="No user message found")

    log.info("Run started — session=%s msg=%.80s", session.id, message)
    generator = run_and_stream(session_id=session.id, message=message, run_id=body.run_id)
    return sse_response(generator)


class AnswerBody(BaseModel):
    answer: str


@app.post("/answer/{session_id}")
async def submit_answer(session_id: str, body: AnswerBody):
    log.info("Answer received — session=%s ans=%.60s", session_id, body.answer)
    ok = set_answer(session_id, body.answer)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


@app.get("/artifacts/{session_id}")
async def list_artifacts(session_id: str):
    workspace = WORKSPACE_BASE / session_id
    if not workspace.exists():
        return {"files": []}
    files = sorted(
        str(f.relative_to(workspace))
        for f in workspace.rglob("*")
        if f.is_file() and not f.name.startswith("_")
    )
    log.info("Artifacts listed — session=%s count=%d", session_id, len(files))
    return {"files": files}


@app.get("/artifact/{session_id}/{path:path}")
async def get_artifact(session_id: str, path: str):
    target = WORKSPACE_BASE / session_id / path
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    log.info("Artifact downloaded — session=%s path=%s", session_id, path)
    return PlainTextResponse(
        content=target.read_text(encoding="utf-8"),
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{target.name}"'},
    )
