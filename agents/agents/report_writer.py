from google.adk.agents import LlmAgent

from .shared import load_prompt, llm
from .tools import list_files, read_file, write_file


def create_report_writer() -> LlmAgent:
    return LlmAgent(
        model=llm(),
        name="report_writer",
        instruction=load_prompt("report_writer"),
        tools=[read_file, list_files, write_file],
    )
