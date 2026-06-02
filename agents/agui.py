"""
SSE streaming bridge: runs the research pipeline and streams events to the browser.
"""

import asyncio
import uuid
from typing import AsyncIterator

from fastapi.responses import StreamingResponse


async def run_and_stream(
    session_id: str,
    message: str,
    run_id: str | None = None,
) -> AsyncIterator[str]:
    from pipeline import run_pipeline

    run_id = run_id or str(uuid.uuid4())
    queue: asyncio.Queue = asyncio.Queue()

    # Run pipeline in background task
    asyncio.create_task(run_pipeline(
        topic=message,
        session_id=session_id,
        run_id=run_id,
        queue=queue,
    ))

    # Stream SSE events from queue
    while True:
        item_type, item = await queue.get()
        if item_type == "done":
            break
        if item_type == "sse":
            yield item


def sse_response(generator: AsyncIterator[str]) -> StreamingResponse:
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
