import asyncio
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import InMemoryRunner
from google.genai import types

load_dotenv()

app = FastAPI(title="Deep Analyst API")


def _llm() -> LiteLlm:
    raw_model = os.getenv("LLM_MODEL", "deepseek-v4-flash-free")
    model_name = raw_model.split("/")[-1]
    return LiteLlm(
        model=f"openai/{model_name}",
        api_base=os.getenv("LLM_BASE_URL"),
        api_key=os.getenv("LLM_API_KEY"),
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


async def verify():
    agent = LlmAgent(
        model=_llm(),
        name="test_agent",
        instruction="You are a helpful assistant. Keep answers short.",
    )

    runner = InMemoryRunner(agent=agent, app_name="verify")
    session = await runner.session_service.create_session(
        app_name="verify", user_id="user"
    )

    print("Sending test message...")
    async for event in runner.run_async(
        user_id="user",
        session_id=session.id,
        new_message=types.Content(
            role="user", parts=[types.Part(text="Say hello in one sentence.")]
        ),
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    print(f"Agent: {part.text}")

    print("✓ Stack verified")


if __name__ == "__main__":
    asyncio.run(verify())
