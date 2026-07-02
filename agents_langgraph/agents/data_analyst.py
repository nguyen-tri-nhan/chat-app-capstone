from .shared import load_prompt
from .spec import AgentSpec
from .tools import list_files, read_file, write_file


def create_data_analyst() -> AgentSpec:
    return AgentSpec(
        name="data_analyst",
        system_prompt=load_prompt("data_analyst"),
        tools={"read_file": read_file, "list_files": list_files, "write_file": write_file},
    )
