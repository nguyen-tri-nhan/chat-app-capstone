from dataclasses import dataclass
from typing import Callable


@dataclass
class AgentSpec:
    """Framework-agnostic description of one pipeline phase's prompt + tools.

    Consumed by pipeline.py's _run_agent_loop, which binds spec.tools to the
    LLM and runs the OpenAI-style tool-calling loop.
    """
    name: str
    system_prompt: str
    tools: dict[str, Callable]
