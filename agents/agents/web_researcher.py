import asyncio
import json
import urllib.parse
import urllib.request

from google.adk.agents import LlmAgent

from .shared import load_prompt, llm
from .tools import write_file

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; research-agent/1.0)"}


def _web_search_sync(query: str) -> str:
    """Synchronous search — must be called via run_in_executor to avoid blocking."""
    try:
        url = "https://api.duckduckgo.com/?" + urllib.parse.urlencode({
            "q": query, "format": "json", "no_html": "1", "skip_disambig": "1",
        })
        req = urllib.request.Request(url, headers=_HEADERS)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())

        parts: list[str] = []
        if data.get("AbstractText"):
            parts.append(f"**{data.get('Heading', query)}**\n{data['AbstractText']}\nSource: {data.get('AbstractURL', '')}")
        for topic in data.get("RelatedTopics", [])[:5]:
            if isinstance(topic, dict) and topic.get("Text"):
                parts.append(f"- {topic['Text']}\n  {topic.get('FirstURL', '')}")
        for result in data.get("Results", [])[:3]:
            if result.get("Text"):
                parts.append(f"**{result['Text']}**\n{result.get('FirstURL', '')}")

        return "\n\n".join(parts) if parts else (
            f"No structured results for '{query}'. Use your training knowledge for this topic."
        )
    except Exception as e:
        return f"Search error for '{query}': {e}"


async def web_search(query: str) -> str:
    """Search the web for a given query. Non-blocking — allows parallel researchers."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _web_search_sync, query)


def create_web_researcher(index: int = 1) -> LlmAgent:
    return LlmAgent(
        model=llm(),
        name=f"web_researcher_{index}",
        instruction=load_prompt("web_researcher"),
        tools=[web_search, write_file],
    )


def create_web_researcher_for(subject: str, index: int = 1) -> LlmAgent:
    """Create a web researcher pre-assigned to a specific subject."""
    instruction = load_prompt("web_researcher") + f"\n\n## Your assigned subject\n{subject}"
    return LlmAgent(
        model=llm(),
        name=f"web_researcher_{index}",
        instruction=instruction,
        tools=[web_search, write_file],
    )
