from google.adk.agents import LlmAgent
from google.adk.code_executors import BuiltInCodeExecutor

from .shared import load_prompt, llm


def create_data_analyst() -> LlmAgent:
    return LlmAgent(
        model=llm(),
        name="data_analyst",
        instruction=load_prompt("data_analyst"),
        code_executor=BuiltInCodeExecutor(),
    )
