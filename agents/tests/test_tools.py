"""Unit tests for shared file tools."""

import pytest

from agents.tools import _session_id, list_files, read_file, write_file


@pytest.fixture(autouse=True)
def set_session(tmp_path, monkeypatch):
    """Each test gets an isolated workspace in a temp dir."""
    import agents.tools as t
    monkeypatch.setattr(t, "WORKSPACE_BASE", tmp_path)
    token = _session_id.set("test-session")
    yield
    _session_id.reset(token)


def test_write_and_read_file():
    write_file("notes/topic.md", "# Hello\nContent here")
    result = read_file("notes/topic.md")
    assert result == "# Hello\nContent here"


def test_write_creates_parent_dirs():
    write_file("deep/nested/dir/file.txt", "data")
    assert read_file("deep/nested/dir/file.txt") == "data"


def test_read_missing_file():
    result = read_file("does_not_exist.md")
    assert "not found" in result.lower()


def test_list_files_empty():
    result = list_files("research_notes")
    assert "not found" in result.lower() or result == "No files found"


def test_list_files_after_write():
    write_file("research_notes/a.md", "A")
    write_file("research_notes/b.md", "B")
    result = list_files("research_notes")
    assert "a.md" in result
    assert "b.md" in result


def test_overwrite_file():
    write_file("file.md", "original")
    write_file("file.md", "updated")
    assert read_file("file.md") == "updated"


def test_list_all_files():
    write_file("research_notes/x.md", "x")
    write_file("analysis/summary.md", "s")
    result = list_files()
    assert "research_notes/x.md" in result
    assert "analysis/summary.md" in result
