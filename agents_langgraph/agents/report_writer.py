from .shared import load_prompt
from .spec import AgentSpec
from .tools import list_files, read_file, write_file


def create_report_writer() -> AgentSpec:
    return AgentSpec(
        name="report_writer",
        system_prompt=load_prompt("report_writer"),
        tools={"read_file": read_file, "list_files": list_files, "write_file": write_file},
    )
