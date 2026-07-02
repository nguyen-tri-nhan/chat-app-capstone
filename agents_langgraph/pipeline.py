"""
LangGraph pipeline orchestrator — mirrors agents/pipeline.py's 4-phase flow and emits the
same AG-UI SSE event sequence, so the existing frontend works unmodified against either backend.

Flow:
  Phase 1: extractor       — LLM extracts subjects, optionally ask_user
  Phase 2: web_researcher  — N agents run in parallel via LangGraph Send() fan-out
  Phase 3: data_analyst    — reads all notes, writes analysis
  Phase 4: report_writer   — writes final report

Agent execution is a hand-rolled OpenAI-style tool-calling loop (_run_agent_loop), not
LangGraph's create_react_agent/astream_events — this is what gives byte-for-byte control over
event granularity (STEP_ACTIVE re-asserted before every chunk, atomic post-hoc tool-call args)
that the frontend's trace tree was built against. See agents/pipeline.py for the ADK original.
"""

import asyncio
import inspect
import json
import operator
import time
import uuid
from typing import Annotated, Any, TypedDict

from logging_config import get_logger

log = get_logger("pipeline")

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
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import END, StateGraph
from langgraph.types import Send

from agents.data_analyst import create_data_analyst
from agents.extractor import create_extractor
from agents.report_writer import create_report_writer
from agents.shared import llm
from agents.spec import AgentSpec
from agents.tools import _event_queue, _session_id
from agents.web_researcher import create_web_researcher_for

MAX_TOOL_ITERATIONS = 15


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


async def _run_agent_loop(
    spec: AgentSpec,
    parent: str | None,
    message: str,
    queue: asyncio.Queue,
) -> str:
    """Run one agent phase, stream events to queue, return text response.

    Direct transliteration of agents/pipeline.py::_run_agent for ADK — same event shapes,
    same "re-assert STEP_ACTIVE before every content item" behavior (required because parallel
    researchers interleave on this one shared queue), same atomic post-hoc tool-call args.
    Assumes the caller has already set the _session_id/_event_queue contextvars for this task.
    """
    model = llm().bind_tools(list(spec.tools.values())) if spec.tools else llm()
    messages: list[BaseMessage] = [SystemMessage(content=spec.system_prompt), HumanMessage(content=message)]
    msg_id = str(uuid.uuid4())
    response_text = ""

    await _step_start(queue, spec.name, parent)

    for _ in range(MAX_TOOL_ITERATIONS):
        accumulated = None
        async for chunk in model.astream(messages):
            await _emit(queue, CustomEvent(
                type=EventType.CUSTOM, name="STEP_ACTIVE",
                value={"stepName": spec.name}, timestamp=_now(),
            ))

            text = chunk.content if isinstance(chunk.content, str) else ""
            if text:
                response_text += text
                await _emit(queue, TextMessageChunkEvent(
                    type=EventType.TEXT_MESSAGE_CHUNK,
                    message_id=msg_id, role="assistant", delta=text, timestamp=_now(),
                ))

            reasoning = chunk.additional_kwargs.get("reasoning_content")
            if reasoning:
                await _emit(queue, ReasoningMessageChunkEvent(
                    type=EventType.REASONING_MESSAGE_CHUNK,
                    message_id=str(uuid.uuid4()), delta=reasoning, timestamp=_now(),
                ))

            accumulated = chunk if accumulated is None else accumulated + chunk

        if accumulated is None:
            break
        messages.append(accumulated)

        if not accumulated.tool_calls:
            break

        for tc in accumulated.tool_calls:
            tc_id = tc.get("id") or str(uuid.uuid4())
            await _emit(queue, CustomEvent(
                type=EventType.CUSTOM, name="STEP_ACTIVE",
                value={"stepName": spec.name}, timestamp=_now(),
            ))
            await _emit(queue, ToolCallStartEvent(
                type=EventType.TOOL_CALL_START,
                tool_call_id=tc_id, tool_call_name=tc["name"], timestamp=_now(),
            ))
            await _emit(queue, ToolCallArgsEvent(
                type=EventType.TOOL_CALL_ARGS,
                tool_call_id=tc_id, delta=json.dumps(tc["args"]), timestamp=_now(),
            ))
            await _emit(queue, ToolCallEndEvent(
                type=EventType.TOOL_CALL_END, tool_call_id=tc_id, timestamp=_now(),
            ))

            fn = spec.tools.get(tc["name"])
            if fn is None:
                result: Any = f"Unknown tool: {tc['name']}"
            elif inspect.iscoroutinefunction(fn):
                result = await fn(**tc["args"])
            else:
                result = fn(**tc["args"])

            content = result if isinstance(result, str) else json.dumps(result)
            await _emit(queue, ToolCallResultEvent(
                type=EventType.TOOL_CALL_RESULT,
                message_id=str(uuid.uuid4()), tool_call_id=tc_id,
                content=content, timestamp=_now(),
            ))
            messages.append(ToolMessage(content=content, tool_call_id=tc_id))
    else:
        log.warning("[%s] MAX_TOOL_ITERATIONS reached", spec.name)

    await _step_end(queue, spec.name)
    return response_text


# ── Graph state ──────────────────────────────────────────────────────────────

class PipelineState(TypedDict, total=False):
    topic: str
    session_id: str
    queue: asyncio.Queue
    subjects: list[str]
    focus: str
    subject: str
    index: int
    researcher_done: Annotated[list[int], operator.add]
    report_text: str


# ── Graph nodes ──────────────────────────────────────────────────────────────

async def _extractor_node(state: PipelineState) -> dict:
    session_id, queue = state["session_id"], state["queue"]
    sid_token = _session_id.set(session_id)
    eq_token = _event_queue.set(queue)
    try:
        log.info("[Phase 1] Extracting subjects")
        subjects: list[str] = []
        focus = ""

        def on_subjects(s: list, f: str = ""):
            nonlocal subjects, focus
            subjects = [str(x) for x in s]
            focus = f

        spec = create_extractor(on_subjects)
        await _run_agent_loop(spec, "research_pipeline", state["topic"], queue)
    finally:
        _session_id.reset(sid_token)
        _event_queue.reset(eq_token)

    if not subjects:
        subjects = [state["topic"].strip()]
        focus = "overview"

    log.info("[Phase 1] Subjects: %s | Focus: %s", subjects, focus)
    return {"subjects": subjects, "focus": focus}


def _fan_out_researchers(state: PipelineState) -> list[Send]:
    log.info("[Phase 2] Launching %d researchers in parallel", len(state["subjects"]))
    return [
        Send("web_researcher", {
            "subject": subject,
            "index": index,
            "focus": state.get("focus", ""),
            "session_id": state["session_id"],
            "queue": state["queue"],
        })
        for index, subject in enumerate(state["subjects"], start=1)
    ]


async def _web_researcher_node(state: PipelineState) -> dict:
    session_id, queue = state["session_id"], state["queue"]
    subject, index, focus = state["subject"], state["index"], state.get("focus", "")
    log.info("[Phase 2] researcher_%d starting: %s", index, subject)

    sid_token = _session_id.set(session_id)
    eq_token = _event_queue.set(queue)
    try:
        spec = create_web_researcher_for(subject, index)
        slug = subject.lower().replace(" ", "_").replace("(", "").replace(")", "")
        msg = f"Research: {subject}\nFocus: {focus}\nSave notes to research_notes/{slug}.md"
        await _run_agent_loop(spec, "research_pipeline", msg, queue)
    finally:
        _session_id.reset(sid_token)
        _event_queue.reset(eq_token)

    return {"researcher_done": [index]}


async def _data_analyst_node(state: PipelineState) -> dict:
    session_id, queue = state["session_id"], state["queue"]
    log.info("[Phase 3] Data analyst starting")
    sid_token = _session_id.set(session_id)
    eq_token = _event_queue.set(queue)
    try:
        spec = create_data_analyst()
        await _run_agent_loop(
            spec, "research_pipeline",
            "Analyze all files in research_notes/ and write analysis/data_summary.md",
            queue,
        )
    finally:
        _session_id.reset(sid_token)
        _event_queue.reset(eq_token)
    log.info("[Phase 3] Data analyst done")
    return {}


async def _report_writer_node(state: PipelineState) -> dict:
    session_id, queue = state["session_id"], state["queue"]
    log.info("[Phase 4] Report writer starting")
    sid_token = _session_id.set(session_id)
    eq_token = _event_queue.set(queue)
    try:
        spec = create_report_writer()
        report_text = await _run_agent_loop(
            spec, "research_pipeline",
            "Read research_notes/ and analysis/data_summary.md. Write the final report to output/final_report.md",
            queue,
        )
    finally:
        _session_id.reset(sid_token)
        _event_queue.reset(eq_token)
    log.info("[Phase 4] Report writer done")
    return {"report_text": report_text}


def _build_graph():
    graph = StateGraph(PipelineState)
    graph.add_node("extractor", _extractor_node)
    graph.add_node("web_researcher", _web_researcher_node)
    graph.add_node("data_analyst", _data_analyst_node)
    graph.add_node("report_writer", _report_writer_node)

    graph.set_entry_point("extractor")
    graph.add_conditional_edges("extractor", _fan_out_researchers, ["web_researcher"])
    graph.add_edge("web_researcher", "data_analyst")
    graph.add_edge("data_analyst", "report_writer")
    graph.add_edge("report_writer", END)

    return graph.compile()


_compiled_graph = _build_graph()


# ── Public entry point ───────────────────────────────────────────────────────

async def run_pipeline(
    topic: str,
    session_id: str,
    run_id: str,
    queue: asyncio.Queue,
):
    """Full research pipeline — pushes SSE strings to queue, ends with ("done", None)."""
    import shutil
    from agents.tools import WORKSPACE_BASE

    log.info("Pipeline starting — session=%s topic=%.80s", session_id, topic)

    # Clean workspace from previous run (avoid stale data bleeding in)
    workspace = WORKSPACE_BASE / session_id
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True, exist_ok=True)

    try:
        await _emit(queue, RunStartedEvent(
            type=EventType.RUN_STARTED, run_id=run_id,
            thread_id=session_id, timestamp=_now(),
        ))

        # ── Root node ────────────────────────────────────────────────────────
        await _step_start(queue, "research_pipeline", parent=None)

        await _compiled_graph.ainvoke(
            {"topic": topic, "session_id": session_id, "queue": queue},
            config={"max_concurrency": 5},
        )

        await _step_end(queue, "research_pipeline")
        log.info("Pipeline complete — session=%s", session_id)

        await _emit(queue, RunFinishedEvent(
            type=EventType.RUN_FINISHED, run_id=run_id,
            thread_id=session_id, timestamp=_now(),
        ))

    except Exception as e:
        log.error("Pipeline error — session=%s: %s", session_id, e, exc_info=True)
        await _emit(queue, RunErrorEvent(
            type=EventType.RUN_ERROR, message=str(e), timestamp=_now(),
        ))
    finally:
        await queue.put(("done", None))
