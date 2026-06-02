from google.adk.agents import LlmAgent

from .data_analyst import create_data_analyst
from .report_writer import create_report_writer
from .shared import load_prompt, llm
from .tools import ask_user
from .web_researcher import create_web_researcher


def create_lead_analyst() -> LlmAgent:
    return LlmAgent(
        model=llm(),
        name="lead_analyst",
        instruction=load_prompt("lead_analyst"),
        tools=[ask_user],
        sub_agents=[
            create_web_researcher(1),
            create_web_researcher(2),
            create_web_researcher(3),
            create_data_analyst(),
            create_report_writer(),
        ],
    )
