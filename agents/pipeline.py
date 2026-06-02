"""
Custom pipeline orchestrator — bypasses ADK's workflow system to get true parallel execution.

Flow:
  Phase 1: extractor       — LLM extracts 3 subjects, optionally ask_user
  Phase 2: web_researcher  — 3 agents run in parallel via asyncio.gather
  Phase 3: data_analyst    — reads all notes, writes analysis
  Phase 4: report_writer   — writes final report
"""

import asyncio
import json
import time
import uuid
from typing import Any

from ag_ui.core import (
    CustomEvent,
    EventType,
    ReasoningMessageChunkEvent,
    RunErrorEvent,
    RunFinishedEvent,
    RunStartedEvent,
    StepFinishedEvent,
    StepStartedEvent,
    TextMessageChunkEvent,
    ToolCallArgsEvent,
    ToolCallEndEvent,
    ToolCallResultEvent,
    ToolCallStartEvent,
)
from google.adk.runners import InMemoryRunner
from google.genai import types

from agents.data_analyst import create_data_analyst
from agents.extractor import create_extractor
from agents.report_writer import create_report_writer
from agents.tools import _event_queue, _session_id, read_file
from agents.web_researcher import create_web_researcher_for


def _now() -> int:
    return int(time.time() * 1000)


def _sse(event: Any) -> str:
    return f"data: {event.model_dump_json(exclude_none=True)}\n\n"


async def _emit(queue: asyncio.Queue, event: Any):
    await queue.put(("sse", _sse(event)))


async def _step_start(queue: asyncio.Queue, step_name: str, parent: str | None):
    await _emit(queue, StepStartedEvent(type=EventType.STEP_STARTED, step_name=step_name, timestamp=_now()))
    await _emit(queue, CustomEvent(
        type=EventType.CUSTOM, name="STEP_META",
        value={"stepName": step_name, "parentStepName": parent}, timestamp=_now(),
    ))
    await _emit(queue, CustomEvent(
        type=EventType.CUSTOM, name="STEP_ACTIVE",
        value={"stepName": step_name}, timestamp=_now(),
    ))


async def _step_end(queue: asyncio.Queue, step_name: str):
    await _emit(queue, StepFinishedEvent(type=EventType.STEP_FINISHED, step_name=step_name, timestamp=_now()))


async def _run_agent(
    agent_name: str,
    parent: str | None,
    runner: InMemoryRunner,
    session_id: str,
    message: str,
    queue: asyncio.Queue,
) -> str:
    """Run one agent phase, stream events to queue, return text response."""
    msg_id = str(uuid.uuid4())
    active_tool_calls: dict[str, str] = {}
    response_text = ""

    await _step_start(queue, agent_name, parent)

    async for event in runner.run_async(
        user_id="user",
        session_id=session_id,
        new_message=types.Content(role="user", parts=[types.Part(text=message)]),
    ):
        # Emit STEP_ACTIVE when author changes (multiple agents sharing session)
        if event.author and event.author != agent_name:
            pass  # sub-agent events already handled separately

        if not event.content or not event.content.parts:
            continue

        for part in event.content.parts:
            # Always re-assert which agent is active before each event —
            # parallel agents interleave on the queue, so the reducer needs
            # this signal before every content item to route correctly.
            await _emit(queue, CustomEvent(
                type=EventType.CUSTOM, name="STEP_ACTIVE",
                value={"stepName": agent_name}, timestamp=_now(),
            ))

            if hasattr(part, "thought") and part.thought and part.text:
                await _emit(queue, ReasoningMessageChunkEvent(
                    type=EventType.REASONING_MESSAGE_CHUNK,
                    message_id=str(uuid.uuid4()), delta=part.text, timestamp=_now(),
                ))
            elif part.text and not (hasattr(part, "thought") and part.thought):
                response_text += part.text
                await _emit(queue, TextMessageChunkEvent(
                    type=EventType.TEXT_MESSAGE_CHUNK,
                    message_id=msg_id, role="assistant", delta=part.text, timestamp=_now(),
                ))
            elif part.function_call:
                fc = part.function_call
                tc_id = str(uuid.uuid4())
                active_tool_calls[fc.id or fc.name] = tc_id
                await _emit(queue, ToolCallStartEvent(
                    type=EventType.TOOL_CALL_START,
                    tool_call_id=tc_id, tool_call_name=fc.name, timestamp=_now(),
                ))
                if fc.args:
                    await _emit(queue, ToolCallArgsEvent(
                        type=EventType.TOOL_CALL_ARGS,
                        tool_call_id=tc_id, delta=json.dumps(fc.args), timestamp=_now(),
                    ))
                await _emit(queue, ToolCallEndEvent(
                    type=EventType.TOOL_CALL_END, tool_call_id=tc_id, timestamp=_now(),
                ))
            elif part.function_response:
                fr = part.function_response
                tc_id = active_tool_calls.get(fr.id or fr.name, str(uuid.uuid4()))
                await _emit(queue, ToolCallResultEvent(
                    type=EventType.TOOL_CALL_RESULT,
                    message_id=str(uuid.uuid4()), tool_call_id=tc_id,
                    content=json.dumps(fr.response) if fr.response else "", timestamp=_now(),
                ))

    await _step_end(queue, agent_name)
    return response_text


async def run_pipeline(
    topic: str,
    session_id: str,
    run_id: str,
    queue: asyncio.Queue,
):
    """Full research pipeline — pushes SSE strings to queue, ends with ("done", None)."""
    import shutil
    from agents.tools import WORKSPACE_BASE

    # Clean workspace from previous run (avoid stale data bleeding in)
    workspace = WORKSPACE_BASE / session_id
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True, exist_ok=True)

    # Inject context vars so tools work
    sid_token = _session_id.set(session_id)
    eq_token  = _event_queue.set(queue)

    try:
        await _emit(queue, RunStartedEvent(
            type=EventType.RUN_STARTED, run_id=run_id,
            thread_id=session_id, timestamp=_now(),
        ))

        # ── Root node ────────────────────────────────────────────────────────
        await _step_start(queue, "research_pipeline", parent=None)

        # ── Phase 1: Extract subjects ────────────────────────────────────────
        subjects: list[str] = []
        focus: str = ""

        def on_subjects(s: list, f: str = ""):
            nonlocal subjects, focus
            subjects = [str(x) for x in s]
            focus = f

        extractor = create_extractor(on_subjects)
        ext_runner = InMemoryRunner(agent=extractor, app_name=f"ext_{session_id}")
        await ext_runner.session_service.create_session(
            app_name=f"ext_{session_id}", user_id="user", session_id=session_id
        )
        await _run_agent("extractor", "research_pipeline", ext_runner, session_id, topic, queue)

        if not subjects:
            # Fallback: parse topic directly
            subjects = [topic.strip()]
            focus = "overview"

        # ── Phase 2: Parallel researchers ───────────────────────────────────
        # Semaphore: max 5 concurrent LLM calls to avoid rate limiting
        sem = asyncio.Semaphore(5)

        async def research_one(subject: str, index: int):
            async with sem:
                app = f"wr{index}_{session_id}"
                agent = create_web_researcher_for(subject, index)
                runner = InMemoryRunner(agent=agent, app_name=app)
                await runner.session_service.create_session(
                    app_name=app, user_id="user", session_id=session_id
                )
                slug = subject.lower().replace(" ", "_").replace("(", "").replace(")", "")
                msg = f"Research: {subject}\nFocus: {focus}\nSave notes to research_notes/{slug}.md"
                await _run_agent(f"web_researcher_{index}", "research_pipeline", runner, session_id, msg, queue)

        await asyncio.gather(*[research_one(s, i + 1) for i, s in enumerate(subjects)])

        # ── Phase 3: Data analyst ────────────────────────────────────────────
        da_app = f"da_{session_id}"
        da = create_data_analyst()
        da_runner = InMemoryRunner(agent=da, app_name=da_app)
        await da_runner.session_service.create_session(
            app_name=da_app, user_id="user", session_id=session_id
        )
        await _run_agent("data_analyst", "research_pipeline", da_runner, session_id,
                         "Analyze all files in research_notes/ and write analysis/data_summary.md", queue)

        # ── Phase 4: Report writer ───────────────────────────────────────────
        rw_app = f"rw_{session_id}"
        rw = create_report_writer()
        rw_runner = InMemoryRunner(agent=rw, app_name=rw_app)
        await rw_runner.session_service.create_session(
            app_name=rw_app, user_id="user", session_id=session_id
        )
        report_text = await _run_agent(
            "report_writer", "research_pipeline", rw_runner, session_id,
            "Read research_notes/ and analysis/data_summary.md. Write the final report to output/final_report.md", queue,
        )

        await _step_end(queue, "research_pipeline")

        await _emit(queue, RunFinishedEvent(
            type=EventType.RUN_FINISHED, run_id=run_id,
            thread_id=session_id, timestamp=_now(),
        ))

    except Exception as e:
        await _emit(queue, RunErrorEvent(
            type=EventType.RUN_ERROR, message=str(e), timestamp=_now(),
        ))
    finally:
        _session_id.reset(sid_token)
        _event_queue.reset(eq_token)
        await queue.put(("done", None))
