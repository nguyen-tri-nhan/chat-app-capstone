"""
Maps Google ADK runner events → AG-UI protocol events and streams them via SSE.
"""

import json
import time
import uuid
from typing import AsyncIterator

from ag_ui.core import (
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
from fastapi.responses import StreamingResponse
from google.adk.runners import InMemoryRunner
from google.genai import types


def _now() -> int:
    return int(time.time() * 1000)


def _sse(event) -> str:
    data = event.model_dump_json(exclude_none=True)
    return f"data: {data}\n\n"


async def run_and_stream(
    runner: InMemoryRunner,
    session_id: str,
    user_id: str,
    message: str,
    run_id: str | None = None,
) -> AsyncIterator[str]:
    run_id = run_id or str(uuid.uuid4())
    thread_id = session_id
    active_steps: dict[str, str] = {}  # author → stepName
    active_tool_calls: dict[str, str] = {}  # function_call id → toolCallId
    msg_id = str(uuid.uuid4())

    yield _sse(RunStartedEvent(type=EventType.RUN_STARTED, run_id=run_id, thread_id=thread_id, timestamp=_now()))

    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=types.Content(role="user", parts=[types.Part(text=message)]),
        ):
            author = event.author or "agent"

            # Step start — first time we see a new author
            if author not in active_steps:
                active_steps[author] = author
                yield _sse(StepStartedEvent(type=EventType.STEP_STARTED, step_name=author, timestamp=_now()))

            if not event.content or not event.content.parts:
                continue

            for part in event.content.parts:
                # Reasoning / thinking
                if hasattr(part, "thought") and part.thought and part.text:
                    yield _sse(ReasoningMessageChunkEvent(
                        type=EventType.REASONING_MESSAGE_CHUNK,
                        message_id=str(uuid.uuid4()),
                        delta=part.text,
                        timestamp=_now(),
                    ))

                # Text response
                elif part.text and not (hasattr(part, "thought") and part.thought):
                    yield _sse(TextMessageChunkEvent(
                        type=EventType.TEXT_MESSAGE_CHUNK,
                        message_id=msg_id,
                        role="assistant",
                        delta=part.text,
                        timestamp=_now(),
                    ))

                # Tool call (function call)
                elif part.function_call:
                    fc = part.function_call
                    tool_call_id = str(uuid.uuid4())
                    active_tool_calls[fc.id or fc.name] = tool_call_id
                    yield _sse(ToolCallStartEvent(
                        type=EventType.TOOL_CALL_START,
                        tool_call_id=tool_call_id,
                        tool_call_name=fc.name,
                        timestamp=_now(),
                    ))
                    if fc.args:
                        yield _sse(ToolCallArgsEvent(
                            type=EventType.TOOL_CALL_ARGS,
                            tool_call_id=tool_call_id,
                            delta=json.dumps(fc.args),
                            timestamp=_now(),
                        ))
                    yield _sse(ToolCallEndEvent(
                        type=EventType.TOOL_CALL_END,
                        tool_call_id=tool_call_id,
                        timestamp=_now(),
                    ))

                # Tool result (function response)
                elif part.function_response:
                    fr = part.function_response
                    tool_call_id = active_tool_calls.get(fr.id or fr.name, str(uuid.uuid4()))
                    yield _sse(ToolCallResultEvent(
                        type=EventType.TOOL_CALL_RESULT,
                        message_id=str(uuid.uuid4()),
                        tool_call_id=tool_call_id,
                        content=json.dumps(fr.response) if fr.response else "",
                        timestamp=_now(),
                    ))

        # Close all open steps
        for step_name in active_steps:
            yield _sse(StepFinishedEvent(type=EventType.STEP_FINISHED, step_name=step_name, timestamp=_now()))

        yield _sse(RunFinishedEvent(type=EventType.RUN_FINISHED, run_id=run_id, thread_id=thread_id, timestamp=_now()))

    except Exception as e:
        yield _sse(RunErrorEvent(type=EventType.RUN_ERROR, message=str(e), timestamp=_now()))


def sse_response(generator: AsyncIterator[str]) -> StreamingResponse:
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
