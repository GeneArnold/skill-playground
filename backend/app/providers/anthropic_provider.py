"""Anthropic (Claude) session — native Messages API with streaming.

For models that support it we enable extended thinking, and we preserve the
returned thinking/tool_use blocks verbatim in history (required when sending
tool results back). That's what lets the trace show real reasoning.
"""
from __future__ import annotations

import anthropic

from .. import config
from .base import Session, ToolCall, TurnResult

MAX_TOKENS = 4096
THINKING_BUDGET = 2048


class AnthropicSession(Session):
    def __init__(self, model, system):
        super().__init__(model, system)
        self.client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
        self.messages: list[dict] = []

    @staticmethod
    def _to_anthropic_tools(tools):
        return [
            {
                "name": t["name"],
                "description": t["description"],
                "input_schema": t["input_schema"] or {"type": "object", "properties": {}},
            }
            for t in tools
        ]

    def add_user(self, text: str) -> None:
        self.messages.append({"role": "user", "content": text})

    def add_assistant_text(self, text: str) -> None:
        self.messages.append({"role": "assistant", "content": text})

    def add_tool_result(self, tool_call_id: str, name: str, result_str: str) -> None:
        self.messages.append({
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": tool_call_id,
                "content": result_str,
            }],
        })

    def step(self, tools):
        anthropic_tools = self._to_anthropic_tools(tools)
        kwargs = {
            "model": self.model.id,
            "max_tokens": MAX_TOKENS,
            "system": self.system,
            "messages": self.messages,
        }
        if anthropic_tools:
            kwargs["tools"] = anthropic_tools
        if self.model.exposes_thinking:
            kwargs["thinking"] = {"type": "enabled", "budget_tokens": THINKING_BUDGET}

        thinking_text = ""
        text = ""
        with self.client.messages.stream(**kwargs) as stream:
            for event in stream:
                if event.type == "content_block_delta":
                    delta = event.delta
                    if delta.type == "text_delta":
                        text += delta.text
                        yield {"type": "text", "text": delta.text}
                    elif delta.type == "thinking_delta":
                        thinking_text += delta.thinking
                        yield {"type": "thinking", "text": delta.thinking}
            final = stream.get_final_message()

        # Preserve the assistant turn verbatim (thinking + tool_use blocks included).
        self.messages.append({
            "role": "assistant",
            "content": [block.model_dump() for block in final.content],
        })

        tool_calls = [
            ToolCall(id=b.id, name=b.name, input=b.input)
            for b in final.content if b.type == "tool_use"
        ]

        self.last_turn = TurnResult(
            text=text,
            thinking=thinking_text,
            tool_calls=tool_calls,
            stop_reason=final.stop_reason or "",
            usage={
                "input_tokens": final.usage.input_tokens,
                "output_tokens": final.usage.output_tokens,
            },
        )
