from ag_ui.core import RunAgentInput
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import InMemoryRunner

from agents.lead_analyst import create_lead_analyst
from agui import run_and_stream, sse_response
from session import Session, create_session, get_session

load_dotenv()

app = FastAPI(title="Deep Analyst API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# One shared runner per process (agents are stateless across sessions)
_agent = create_lead_analyst()
_runner: InMemoryRunner | None = None


def get_runner() -> InMemoryRunner:
    global _runner
    if _runner is None:
        _runner = InMemoryRunner(agent=_agent, app_name="deep_analyst")
    return _runner


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/sessions")
async def create_new_session() -> dict:
    runner = get_runner()
    session = create_session()
    await runner.session_service.create_session(
        app_name="deep_analyst", user_id=session.user_id, session_id=session.id
    )
    return {"session_id": session.id}


@app.post("/runs")
async def run_agent(body: RunAgentInput):
    """AG-UI compatible endpoint — accepts RunAgentInput, streams AG-UI events."""
    thread_id = body.thread_id or ""
    session = get_session(thread_id)

    if not session:
        # Auto-create session if not found
        runner = get_runner()
        session = Session(id=thread_id or __import__("uuid").uuid4().__str__(), user_id="user")
        await runner.session_service.create_session(
            app_name="deep_analyst", user_id=session.user_id, session_id=session.id
        )

    # Extract latest user message
    message = ""
    if body.messages:
        for msg in reversed(body.messages):
            if msg.role == "user":
                for block in (msg.content or []):
                    if hasattr(block, "text"):
                        message = block.text
                        break
            if message:
                break

    if not message:
        raise HTTPException(status_code=400, detail="No user message found")

    runner = get_runner()
    generator = run_and_stream(
        runner=runner,
        session_id=session.id,
        user_id=session.user_id,
        message=message,
        run_id=body.run_id,
    )
    return sse_response(generator)
