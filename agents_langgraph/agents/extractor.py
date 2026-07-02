from typing import Callable

from .shared import load_prompt
from .spec import AgentSpec
from .tools import ask_user


def create_extractor(on_subjects: Callable[[list, str], None]) -> AgentSpec:
    """
    on_subjects: callable(subjects: list[str], focus: str) — called when agent submits subjects.
    """
    def submit_subjects(subjects: list, focus: str = "") -> str:
        """Submit the final list of subjects to research and a short focus description."""
        on_subjects(subjects, focus)
        return f"Subjects submitted: {subjects}"

    return AgentSpec(
        name="extractor",
        system_prompt=load_prompt("extractor"),
        tools={"ask_user": ask_user, "submit_subjects": submit_subjects},
    )
