from google.adk.agents import LlmAgent
from google.adk.code_executors import BuiltInCodeExecutor

from .shared import load_prompt, llm


def create_report_writer() -> LlmAgent:
    return LlmAgent(
        model=llm(),
        name="report_writer",
        instruction=load_prompt("report_writer"),
        code_executor=BuiltInCodeExecutor(),
    )
