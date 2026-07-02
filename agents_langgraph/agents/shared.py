import logging
import os

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

from deep_analyst_shared.prompts import load_prompt  # noqa: F401

load_dotenv()

logging.getLogger("openai").setLevel(logging.WARNING)


def llm() -> ChatOpenAI:
    raw_model = os.getenv("LLM_MODEL", "deepseek-v4-flash-free")
    model_name = raw_model.split("/")[-1]
    return ChatOpenAI(
        model=model_name,
        base_url=os.getenv("LLM_BASE_URL"),
        api_key=os.getenv("LLM_API_KEY"),
        streaming=True,
    )
