from google.adk.agents import LlmAgent
from google.adk.agents.sequential_agent import SequentialAgent

from .data_analyst import create_data_analyst
from .report_writer import create_report_writer
from .shared import load_prompt, llm
from .web_researcher import create_web_researcher


def create_lead_analyst() -> LlmAgent:
    web_researcher_1 = create_web_researcher(1)
    web_researcher_2 = create_web_researcher(2)
    web_researcher_3 = create_web_researcher(3)

    # data-analyst và report-writer chạy tuần tự sau khi researchers xong
    post_research_pipeline = SequentialAgent(
        name="post_research_pipeline",
        sub_agents=[create_data_analyst(), create_report_writer()],
    )

    return LlmAgent(
        model=llm(),
        name="lead_analyst",
        instruction=load_prompt("lead_analyst"),
        sub_agents=[
            web_researcher_1,
            web_researcher_2,
            web_researcher_3,
            post_research_pipeline,
        ],
    )
