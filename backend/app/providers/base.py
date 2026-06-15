"""Provider-neutral session interface.

The chat loop is provider-agnostic. It drives a `Session`:

    session = make_session(model, system)
    session.add_user(text)
    while True:
        for event in session.step(tools):  # streams ONE assistant turn
            yield event                     # {"type": "thinking"|"text", "text": ...}
        turn = session.last_turn            # TurnResult
        if not turn.tool_calls:
            break
        for call in turn.tool_calls:
            result_str = run_the_script(call)
            session.add_tool_result(call.id, call.name, result_str)

Tools are passed to step() on EACH turn (not fixed at construction), so the
available tool set can grow as the model "opens" skills (progressive disclosure).

Each provider subclass keeps its OWN native message history internally, so
provider-specific concerns (e.g. preserving Anthropic "thinking" blocks across
tool calls) stay encapsulated.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ToolCall:
    id: str
    name: str
    input: dict


@dataclass
class TurnResult:
    text: str = ""
    thinking: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    stop_reason: str = ""
    usage: dict = field(default_factory=dict)


class Session:
    """One conversation against one model. Subclasses implement the API calls."""

    def __init__(self, model, system: str):
        self.model = model
        self.system = system
        self.last_turn: TurnResult | None = None

    def add_user(self, text: str) -> None:
        raise NotImplementedError

    def add_assistant_text(self, text: str) -> None:
        """Seed a prior assistant turn (plain text) when replaying history."""
        raise NotImplementedError

    def add_tool_result(self, tool_call_id: str, name: str, result_str: str) -> None:
        raise NotImplementedError

    def step(self, tools: list[dict]):
        """Generator: stream one assistant turn using the given tool set (neutral
        format: [{name, description, input_schema}]). Yields event dicts, then
        sets self.last_turn. Must yield only {"type": "thinking"|"text", "text"}."""
        raise NotImplementedError
