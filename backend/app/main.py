"""FastAPI app for the Skill Playground."""
from __future__ import annotations

import re
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from . import config, instructions as instructions_mod, skills as skills_mod
from .chat import run_assist, run_chat, run_explain
from .models import available_models

app = FastAPI(title="Skill Playground")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local single-user tool
    allow_methods=["*"],
    allow_headers=["*"],
)

_SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


# ---------- schemas ----------
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str
    enabled_skills: list[str] = []
    messages: list[ChatMessage]


class ExplainRequest(BaseModel):
    model: str
    trace: list[dict]
    question: str = ""


class SkillWrite(BaseModel):
    skill_md: str
    script_source: str | None = None


class SkillCreate(BaseModel):
    folder: str
    skill_md: str
    script_source: str | None = None


# ---------- read endpoints ----------
@app.get("/api/health")
def health():
    return {"ok": True, "skills_dir": str(config.SKILLS_DIR)}


@app.get("/api/models")
def list_models():
    return [
        {
            "id": m.id, "label": m.label, "provider": m.provider,
            "tier": m.tier, "exposes_thinking": m.exposes_thinking,
            "local": m.local,
        }
        for m in available_models()
    ]


@app.get("/api/skills")
def list_skills():
    return [s.to_public() for s in skills_mod.load_skills()]


# ---------- instructions (editable base system prompt) ----------
class InstructionsWrite(BaseModel):
    instructions: str


@app.get("/api/instructions")
def get_instructions():
    return {
        "instructions": instructions_mod.get_instructions(),
        "default": instructions_mod.DEFAULT_INSTRUCTIONS,
        "is_custom": instructions_mod.is_custom(),
    }


@app.put("/api/instructions")
def put_instructions(body: InstructionsWrite):
    instructions_mod.set_instructions(body.instructions)
    return {"instructions": instructions_mod.get_instructions(), "is_custom": True}


# ---------- chat (SSE) ----------
@app.post("/api/chat")
def chat(req: ChatRequest):
    gen = run_chat(
        model_id=req.model,
        enabled_skill_names=req.enabled_skills,
        history=[m.model_dump() for m in req.messages],
    )
    return StreamingResponse(gen, media_type="text/event-stream", headers=_SSE_HEADERS)


@app.post("/api/explain")
def explain(req: ExplainRequest):
    gen = run_explain(model_id=req.model, trace=req.trace, question=req.question)
    return StreamingResponse(gen, media_type="text/event-stream", headers=_SSE_HEADERS)


class AssistRequest(BaseModel):
    model: str
    instruction: str = ""
    frontmatter: str = ""
    script: str = ""


@app.post("/api/assist")
def assist(req: AssistRequest):
    gen = run_assist(
        model_id=req.model, instruction=req.instruction,
        frontmatter=req.frontmatter, script=req.script,
    )
    return StreamingResponse(gen, media_type="text/event-stream", headers=_SSE_HEADERS)


# ---------- skill editing ----------
_SAFE_FOLDER = re.compile(r"^[A-Za-z0-9_-]+$")


def _skill_dir(folder: str) -> Path:
    if not _SAFE_FOLDER.match(folder):
        raise HTTPException(400, "Invalid folder name.")
    return (config.SKILLS_DIR / folder).resolve()


def _script_name_from_md(skill_md: str) -> str | None:
    m = re.search(r"^script:\s*(.+)$", skill_md, re.MULTILINE)
    if not m:
        return None
    return m.group(1).strip().strip("\"'")


@app.put("/api/skills/{folder}")
def save_skill(folder: str, body: SkillWrite):
    target = _skill_dir(folder)
    if not target.is_dir():
        raise HTTPException(404, f"Skill folder '{folder}' not found.")

    (target / "SKILL.md").write_text(body.skill_md)

    # Only write a script if the frontmatter declares one. A skill with no
    # `script:` field is instruction-only — there's nothing to write.
    if body.script_source is not None:
        script_name = _script_name_from_md(body.skill_md)
        if script_name:
            if "/" in script_name or "\\" in script_name:
                raise HTTPException(400, "Script name may not contain path separators.")
            (target / script_name).write_text(body.script_source)

    saved = skills_mod.get_skill_by_folder(folder)
    return saved.to_public() if saved else {"folder": folder}


@app.post("/api/skills")
def create_skill(body: SkillCreate):
    target = _skill_dir(body.folder)
    if target.exists():
        raise HTTPException(409, f"Skill folder '{body.folder}' already exists.")
    target.mkdir(parents=True)
    (target / "SKILL.md").write_text(body.skill_md)
    if body.script_source is not None:
        script_name = _script_name_from_md(body.skill_md)
        if script_name and "/" not in script_name and "\\" not in script_name:
            (target / script_name).write_text(body.script_source)
    saved = skills_mod.get_skill_by_folder(body.folder)
    return saved.to_public() if saved else {"folder": body.folder}
