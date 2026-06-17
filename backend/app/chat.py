"""The tool-use loop. Drives a provider Session and emits a typed event stream.

Every event yielded here is one entry in the *trace* — the whole point of the
playground. The frontend renders these as both chat and a step-by-step timeline,
and uses tool_call / tool_execution events to light up the active skill.

Progressive disclosure (how real skills work):
  - Upfront, the model sees only each skill's METADATA (name + description) plus
    an `open_skill` tool. No skill bodies, no script tools — minimal context.
  - When the model judges a skill relevant, it calls open_skill(name). That loads
    the skill's full SKILL.md body into the conversation AND reveals that skill's
    script tool on the next turn. Bodies/tools are loaded only when needed.
  - Tools are recomputed each turn, so the available set grows as skills open.

Event types emitted:
  system_prompt   {text}                                   <- metadata-only prompt
  skills_available{skills:[{name, description, folder}]}    <- the "table of contents"
  user_message    {text}
  turn_start      {index, model}
  thinking_delta  {text}
  text_delta      {text}
  tool_call       {id, name, skill_folder, input}          <- model decided to call
  skill_opened    {name, skill_folder, instructions_chars} <- body pulled into context
  tool_execution  {id, name, skill_folder, execution{...}} <- script ran
  tool_result     {id, name, result}                        <- fed back to model
  final           {text, usage, model}
  error           {message}
  done            {}
"""
from __future__ import annotations

import json
from typing import Iterator

from . import instructions as instructions_mod
from . import skills as skills_mod
from .models import get_model
from .providers import make_session
from .runner import run_skill_script

MAX_TOOL_ITERATIONS = 8

OPEN_SKILL = "open_skill"


def _build_system_prompt(active_skills: list) -> str:
    """Editable base instructions + a metadata-only listing of each skill.

    The base ("Instructions") comes from the instructions module (user-editable).
    This does NOT include skill bodies — those are loaded on demand via open_skill
    (progressive disclosure), so unused skills never bloat the context.
    """
    base = instructions_mod.get_instructions()
    if not active_skills:
        return base + "\n\n(No skills are currently enabled.)"
    lines = [base, "\n\n## Available skills (metadata only)"]
    for s in active_skills:
        desc = " ".join(s.description.split())  # collapse whitespace for the listing
        lines.append(f"\n- {s.name}: {desc}")
    return "".join(lines)


def _open_skill_tool(skill_names: list[str]) -> dict:
    return {
        "name": OPEN_SKILL,
        "description": (
            "Load the full instructions for one of the available skills and "
            "enable its tool. Call this first, when you decide a skill is "
            "relevant, before using that skill."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "enum": skill_names,
                    "description": "The name of the skill to open.",
                }
            },
            "required": ["name"],
        },
    }


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


def run_chat(
    model_id: str,
    enabled_skill_names: list[str],
    history: list[dict],
) -> Iterator[str]:
    """Yield SSE-formatted trace events for one user turn.

    `history` is plain {role, content} turns; the last item is the new user
    message. Prior turns are replayed as text (tool calls are not re-executed).
    """
    model = get_model(model_id)
    if model is None:
        yield _sse({"type": "error", "message": f"Unknown model '{model_id}'."})
        yield _sse({"type": "done"})
        return

    # Resolve enabled skills. A skill is usable if it parsed cleanly — it does
    # NOT need a script. Script-less skills are pure instructions: opening one
    # loads its guidance into context and shapes how the model responds, with no
    # tool to call. That teaches that skills are fundamentally instructions.
    all_skills = {s.name: s for s in skills_mod.load_skills()}
    active = [
        all_skills[n] for n in enabled_skill_names
        if n in all_skills and not all_skills[n].error
    ]
    skill_by_name = {s.name: s for s in active}
    opened: set[str] = set()  # skills whose body has been loaded this conversation

    def current_tools() -> list[dict]:
        """open_skill plus the script tool of every opened skill that HAS a script."""
        tools: list[dict] = []
        if active:
            tools.append(_open_skill_tool([s.name for s in active]))
        for s in active:
            if s.name in opened and s.script:
                tools.append(s.to_tool_def())
        return tools

    if not history or history[-1].get("role") != "user":
        yield _sse({"type": "error", "message": "Last message must be from the user."})
        yield _sse({"type": "done"})
        return

    system_prompt = _build_system_prompt(active)
    try:
        session = make_session(model, system_prompt)
    except Exception as exc:  # noqa: BLE001 — surface any setup error to the learner
        yield _sse({"type": "error", "message": f"Could not start model: {exc}"})
        yield _sse({"type": "done"})
        return

    # Show the learner the metadata-only context the model starts with.
    yield _sse({"type": "system_prompt", "text": system_prompt})
    yield _sse({
        "type": "skills_available",
        "skills": [
            {"name": s.name, "description": s.description, "folder": s.folder}
            for s in active
        ],
    })

    # Replay prior turns, then add the new user message.
    for msg in history[:-1]:
        if msg["role"] == "user":
            session.add_user(msg["content"])
        elif msg["role"] == "assistant":
            session.add_assistant_text(msg["content"])
    new_user = history[-1]["content"]
    session.add_user(new_user)
    yield _sse({"type": "user_message", "text": new_user})

    try:
        for iteration in range(MAX_TOOL_ITERATIONS):
            yield _sse({"type": "turn_start", "index": iteration, "model": model.id})

            for event in session.step(current_tools()):
                if event["type"] == "thinking":
                    yield _sse({"type": "thinking_delta", "text": event["text"]})
                else:
                    yield _sse({"type": "text_delta", "text": event["text"]})

            turn = session.last_turn

            if not turn.tool_calls:
                yield _sse({
                    "type": "final",
                    "text": turn.text,
                    "usage": turn.usage,
                    "model": model.id,
                })
                break

            for call in turn.tool_calls:
                # --- open_skill: progressive disclosure of a skill's body ---
                if call.name == OPEN_SKILL:
                    requested = (call.input or {}).get("name")
                    skill = skill_by_name.get(requested)
                    folder = skill.folder if skill else None
                    yield _sse({
                        "type": "tool_call", "id": call.id, "name": OPEN_SKILL,
                        "skill_folder": folder, "input": call.input,
                    })
                    if skill is None:
                        result_str = json.dumps({
                            "error": f"No such skill '{requested}'."})
                    else:
                        opened.add(skill.name)
                        body = skill.body.strip() or "(this skill has no instructions)"
                        if skill.script:
                            preamble = (
                                f"Skill '{skill.name}' is now open and its tool is "
                                f"enabled. Follow these instructions, then call the "
                                f"'{skill.name}' tool:"
                            )
                        else:
                            preamble = (
                                f"Skill '{skill.name}' is now open. It has no tool — "
                                f"just follow these instructions in your reply:"
                            )
                        result_str = f"{preamble}\n\n{body}"
                        yield _sse({
                            "type": "skill_opened", "name": skill.name,
                            "skill_folder": folder, "instructions_chars": len(body),
                        })
                    session.add_tool_result(call.id, OPEN_SKILL, result_str)
                    yield _sse({
                        "type": "tool_result", "id": call.id, "name": OPEN_SKILL,
                        "result": result_str,
                    })
                    continue

                # --- a skill's script tool ---
                skill = skill_by_name.get(call.name)
                folder = skill.folder if skill else None
                yield _sse({
                    "type": "tool_call",
                    "id": call.id,
                    "name": call.name,
                    "skill_folder": folder,
                    "input": call.input,
                })

                if skill is None:
                    result_str = json.dumps({
                        "error": f"Model called unknown skill '{call.name}'."})
                    yield _sse({
                        "type": "tool_execution",
                        "id": call.id, "name": call.name, "skill_folder": folder,
                        "execution": {"ok": False, "error": result_str},
                    })
                else:
                    execution = run_skill_script(skill, call.input)
                    result_str = execution.result_for_model()
                    yield _sse({
                        "type": "tool_execution",
                        "id": call.id, "name": call.name, "skill_folder": folder,
                        "execution": execution.as_dict(),
                    })

                session.add_tool_result(call.id, call.name, result_str)
                yield _sse({
                    "type": "tool_result",
                    "id": call.id, "name": call.name, "result": result_str,
                })
        else:
            yield _sse({
                "type": "error",
                "message": f"Stopped after {MAX_TOOL_ITERATIONS} tool rounds "
                           "(possible loop).",
            })
    except Exception as exc:  # noqa: BLE001
        yield _sse({"type": "error", "message": f"{type(exc).__name__}: {exc}"})

    yield _sse({"type": "done"})


EXPLAIN_SYSTEM_PROMPT = (
    "You are a patient teacher of AI skill-building. The user will show you the "
    "full execution trace of a previous turn — their message, the model's "
    "reasoning, the exact tool/skill calls it made, the arguments it passed, "
    "what the skill scripts returned, and the final answer. Explain clearly WHY "
    "the model behaved as it did, and give concrete, actionable advice on how to "
    "improve the skill's description, its input schema, or the prompt so the "
    "model uses it more reliably. Be specific and reference what you see in the "
    "trace. Do not call any tools — just explain."
)


ASSIST_SYSTEM_PROMPT = (
    "You are a friendly coding copilot inside a Skill Playground. The user is "
    "learning to BUILD SKILLS, not to code — so do the Python for them and keep "
    "things simple and encouraging. You help write and debug the small Python "
    "script for a skill and keep its YAML frontmatter (especially input_schema) "
    "in sync with the script.\n\n"
    "The script contract is strict and always the same:\n"
    "- Read ONE JSON object from stdin (the arguments; keys match input_schema).\n"
    "- Print ONE JSON object to stdout (the result).\n"
    "- Exit 0 on success. On error, print a short message to stderr and exit non-zero.\n"
    "- Use only the Python standard library. Keep it short and readable.\n\n"
    "When you give code, ALWAYS output the COMPLETE file in a single fenced block "
    "so it can replace the editor contents — never a partial snippet:\n"
    "- Use a ```python block for the full script.\n"
    "- Use a ```yaml block for the full frontmatter, but ONLY if you changed it "
    "(e.g. adjusted input_schema or added a `script:` field).\n"
    "Briefly explain, in plain language, what you did and why. Do not call any tools."
)


def run_assist(
    model_id: str, instruction: str, frontmatter: str, script: str
) -> Iterator[str]:
    """Copilot for the skill editor. Streams an explanation plus full code blocks."""
    model = get_model(model_id)
    if model is None:
        yield _sse({"type": "error", "message": f"Unknown model '{model_id}'."})
        yield _sse({"type": "done"})
        return

    user_msg = (
        "Here is my skill so far.\n\n"
        f"Frontmatter (YAML):\n```yaml\n{frontmatter.strip() or '(empty)'}\n```\n\n"
        f"Current script (Python):\n```python\n{script.strip() or '(empty)'}\n```\n\n"
        f"My request: {instruction.strip() or 'Write the script described by the frontmatter.'}"
    )

    try:
        session = make_session(model, ASSIST_SYSTEM_PROMPT)
        session.add_user(user_msg)
        for event in session.step([]):
            if event["type"] == "thinking":
                yield _sse({"type": "thinking_delta", "text": event["text"]})
            else:
                yield _sse({"type": "text_delta", "text": event["text"]})
        yield _sse({"type": "final", "text": session.last_turn.text, "model": model.id})
    except Exception as exc:  # noqa: BLE001
        yield _sse({"type": "error", "message": f"{type(exc).__name__}: {exc}"})

    yield _sse({"type": "done"})


def run_explain(model_id: str, trace: list[dict], question: str) -> Iterator[str]:
    """Coach the user about a prior turn. No tools; just a streamed explanation."""
    model = get_model(model_id)
    if model is None:
        yield _sse({"type": "error", "message": f"Unknown model '{model_id}'."})
        yield _sse({"type": "done"})
        return

    trace_text = json.dumps(trace, indent=2, default=str)
    user_msg = (
        f"Here is the trace of a previous turn:\n\n```json\n{trace_text}\n```\n\n"
        f"My question: {question or 'Why did the model behave this way, and how can I improve the skill?'}"
    )

    try:
        session = make_session(model, EXPLAIN_SYSTEM_PROMPT)
        session.add_user(user_msg)
        for event in session.step([]):
            if event["type"] == "thinking":
                yield _sse({"type": "thinking_delta", "text": event["text"]})
            else:
                yield _sse({"type": "text_delta", "text": event["text"]})
        yield _sse({"type": "final", "text": session.last_turn.text, "model": model.id})
    except Exception as exc:  # noqa: BLE001
        yield _sse({"type": "error", "message": f"{type(exc).__name__}: {exc}"})

    yield _sse({"type": "done"})
