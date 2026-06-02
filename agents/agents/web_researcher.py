from google.adk.agents import LlmAgent
from google.adk.tools import google_search

from .shared import load_prompt, llm


def create_web_researcher(index: int = 1) -> LlmAgent:
    return LlmAgent(
        model=llm(),
        name=f"web_researcher_{index}",
        instruction=load_prompt("web_researcher"),
        tools=[google_search],
    )
