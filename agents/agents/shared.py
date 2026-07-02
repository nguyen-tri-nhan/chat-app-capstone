import logging
import os

from dotenv import load_dotenv
from google.adk.models.lite_llm import LiteLlm

from deep_analyst_shared.prompts import load_prompt  # noqa: F401

load_dotenv()

# Suppress LiteLLM's AWS pre-load warnings (botocore not installed — we don't use Bedrock)
logging.getLogger("LiteLLM").setLevel(logging.ERROR)


def llm() -> LiteLlm:
    raw_model = os.getenv("LLM_MODEL", "deepseek-v4-flash-free")
    model_name = raw_model.split("/")[-1]
    return LiteLlm(
        model=f"openai/{model_name}",
        api_base=os.getenv("LLM_BASE_URL"),
        api_key=os.getenv("LLM_API_KEY"),
    )
