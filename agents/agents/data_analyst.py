from google.adk.agents import LlmAgent

from .shared import load_prompt, llm
from .tools import list_files, read_file, write_file


def create_data_analyst() -> LlmAgent:
    return LlmAgent(
        model=llm(),
        name="data_analyst",
        instruction=load_prompt("data_analyst"),
        tools=[read_file, list_files, write_file],
    )
