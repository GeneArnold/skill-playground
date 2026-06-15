"""Executes a skill's script as a subprocess.

Contract: JSON arguments go in on stdin, a JSON result comes out on stdout.
We capture everything (stdin, stdout, stderr, exit code, duration) so the trace
view can show the learner *exactly* what happened — including malformed input
from a model that got the arguments wrong.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from dataclasses import asdict, dataclass

from . import config
from .skills import Skill


@dataclass
class ExecutionResult:
    ok: bool
    stdin: str            # exactly what we sent the script
    stdout: str
    stderr: str
    exit_code: int | None
    duration_ms: int
    parsed_output: object | None   # stdout parsed as JSON, if it parsed
    error: str | None              # harness-level error (timeout, no script, bad json)

    def as_dict(self) -> dict:
        return asdict(self)

    def result_for_model(self) -> str:
        """What gets fed back to the model as the tool result."""
        if self.ok and self.parsed_output is not None:
            return json.dumps(self.parsed_output)
        # On failure, hand the model a structured error so it can react/explain.
        return json.dumps({
            "error": self.error or "script failed",
            "exit_code": self.exit_code,
            "stderr": self.stderr.strip()[:2000],
        })


def run_skill_script(skill: Skill, arguments: dict) -> ExecutionResult:
    stdin_payload = json.dumps(arguments)

    if not skill.script_path:
        return ExecutionResult(
            ok=False, stdin=stdin_payload, stdout="", stderr="", exit_code=None,
            duration_ms=0, parsed_output=None,
            error=f"Skill '{skill.name}' has no script to run.",
        )

    start = time.monotonic()
    try:
        proc = subprocess.run(
            [sys.executable, skill.script_path],
            input=stdin_payload,
            capture_output=True,
            text=True,
            timeout=config.SCRIPT_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        duration_ms = int((time.monotonic() - start) * 1000)
        return ExecutionResult(
            ok=False, stdin=stdin_payload, stdout="", stderr="", exit_code=None,
            duration_ms=duration_ms, parsed_output=None,
            error=f"Script timed out after {config.SCRIPT_TIMEOUT_SECONDS}s.",
        )

    duration_ms = int((time.monotonic() - start) * 1000)

    parsed_output = None
    parse_error = None
    if proc.returncode == 0:
        try:
            parsed_output = json.loads(proc.stdout) if proc.stdout.strip() else None
        except json.JSONDecodeError as exc:
            parse_error = f"Script stdout was not valid JSON: {exc}"

    ok = proc.returncode == 0 and parse_error is None
    error = None
    if proc.returncode != 0:
        error = f"Script exited with code {proc.returncode}."
    elif parse_error:
        error = parse_error

    return ExecutionResult(
        ok=ok,
        stdin=stdin_payload,
        stdout=proc.stdout,
        stderr=proc.stderr,
        exit_code=proc.returncode,
        duration_ms=duration_ms,
        parsed_output=parsed_output,
        error=error,
    )
