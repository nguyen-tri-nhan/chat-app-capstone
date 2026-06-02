import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from google.adk.models.lite_llm import LiteLlm

load_dotenv()

# Suppress LiteLLM's AWS pre-load warnings (botocore not installed — we don't use Bedrock)
logging.getLogger("LiteLLM").setLevel(logging.ERROR)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
WORKSPACE_DIR = Path(__file__).parent.parent / "workspace"


def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text()


def llm() -> LiteLlm:
    raw_model = os.getenv("LLM_MODEL", "deepseek-v4-flash-free")
    model_name = raw_model.split("/")[-1]
    return LiteLlm(
        model=f"openai/{model_name}",
        api_base=os.getenv("LLM_BASE_URL"),
        api_key=os.getenv("LLM_API_KEY"),
    )
