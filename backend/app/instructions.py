"""The editable base system prompt (a.k.a. "Instructions").

This is the top of every chat's system prompt. The live prompt the model sees is
this text PLUS an auto-generated "Available skills" metadata listing (added by
chat._build_system_prompt). Persisted to a file so edits survive restarts.
"""
from __future__ import annotations

from . import config

DEFAULT_INSTRUCTIONS = (
    "You are a helpful assistant running inside a Skill Playground — a tool for "
    "learning how AI skills work. You have a set of skills available. Only each "
    "skill's name and short description are shown to you up front. To actually "
    "USE a skill, you must first call the `open_skill` tool with the skill's "
    "name: that loads the skill's full instructions and enables its tool. Open a "
    "skill only when you judge it relevant to the user's request, then follow its "
    "instructions and call its tool. Don't open skills you don't need."
)


def get_instructions() -> str:
    path = config.INSTRUCTIONS_FILE
    if path.is_file():
        return path.read_text()
    return DEFAULT_INSTRUCTIONS


def set_instructions(text: str) -> None:
    config.INSTRUCTIONS_FILE.write_text(text)


def is_custom() -> bool:
    return config.INSTRUCTIONS_FILE.is_file()
