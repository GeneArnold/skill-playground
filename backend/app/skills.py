"""Skill discovery and parsing.

A skill is a folder under SKILLS_DIR containing a SKILL.md with YAML frontmatter:

    ---
    name: calculator
    description: ...
    script: calculate.py
    input_schema: { ...JSON Schema... }
    ---
    <markdown body — instructions for humans and the model>

This mirrors the real Anthropic skill layout, extended with `script` and
`input_schema` so each skill maps cleanly onto a function-calling tool.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from . import config

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", re.DOTALL)


@dataclass
class Skill:
    name: str
    description: str
    script: str | None
    input_schema: dict
    body: str
    folder: str           # folder name on disk
    skill_md_path: str
    script_path: str | None
    raw_skill_md: str
    frontmatter: str = ""  # the raw YAML text between the --- fences
    error: str | None = None  # set if the skill failed to parse

    def to_public(self) -> dict:
        """Shape sent to the frontend."""
        return {
            "name": self.name,
            "description": self.description,
            "script": self.script,
            "input_schema": self.input_schema,
            "frontmatter": self.frontmatter,
            "body": self.body,
            "folder": self.folder,
            "raw_skill_md": self.raw_skill_md,
            "script_source": self._read_script_source(),
            "error": self.error,
        }

    def _read_script_source(self) -> str | None:
        if self.script_path and Path(self.script_path).is_file():
            return Path(self.script_path).read_text()
        return None

    def to_tool_def(self) -> dict:
        """Provider-neutral tool definition (name/description/schema)."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema or {"type": "object", "properties": {}},
        }


def _parse_skill_md(text: str, folder: Path) -> Skill:
    match = _FRONTMATTER_RE.match(text)
    if not match:
        return Skill(
            name=folder.name, description="", script=None, input_schema={},
            body=text, folder=folder.name, skill_md_path=str(folder / "SKILL.md"),
            script_path=None, raw_skill_md=text,
            error="No YAML frontmatter found (expected a block fenced by ---).",
        )

    frontmatter_raw, body = match.group(1), match.group(2)
    try:
        meta = yaml.safe_load(frontmatter_raw) or {}
    except yaml.YAMLError as exc:
        return Skill(
            name=folder.name, description="", script=None, input_schema={},
            body=body, folder=folder.name, skill_md_path=str(folder / "SKILL.md"),
            script_path=None, raw_skill_md=text, frontmatter=frontmatter_raw,
            error=f"Frontmatter is not valid YAML: {exc}",
        )

    name = meta.get("name", folder.name)
    script = meta.get("script")
    script_path = str(folder / script) if script else None
    error = None
    if script and not Path(script_path).is_file():
        error = f"Script '{script}' referenced in frontmatter does not exist."

    return Skill(
        name=name,
        description=meta.get("description", "").strip(),
        script=script,
        input_schema=meta.get("input_schema", {}) or {},
        body=body.strip(),
        folder=folder.name,
        skill_md_path=str(folder / "SKILL.md"),
        script_path=script_path,
        raw_skill_md=text,
        frontmatter=frontmatter_raw.strip(),
        error=error,
    )


def load_skills() -> list[Skill]:
    """Scan SKILLS_DIR and parse every skill folder. Fresh each call (hot reload)."""
    skills: list[Skill] = []
    skills_dir = config.SKILLS_DIR
    if not skills_dir.is_dir():
        return skills

    for folder in sorted(p for p in skills_dir.iterdir() if p.is_dir()):
        skill_md = folder / "SKILL.md"
        if not skill_md.is_file():
            continue
        skills.append(_parse_skill_md(skill_md.read_text(), folder))
    return skills


def get_skill(name: str) -> Skill | None:
    for s in load_skills():
        if s.name == name:
            return s
    return None


def get_skill_by_folder(folder: str) -> Skill | None:
    for s in load_skills():
        if s.folder == folder:
            return s
    return None
