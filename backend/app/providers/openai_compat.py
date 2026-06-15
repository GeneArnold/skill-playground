"""OpenAI-compatible session — covers xAI Grok and DeepSeek.

Both speak the /chat/completions API with function-calling tools, so one adapter
serves both; only base_url and the API key differ (carried on ModelInfo).
We stream via raw httpx SSE so we can surface text and any reasoning deltas.
"""
from __future__ import annotations

import json
import re

import httpx

from .. import config
from .base import Session, ToolCall, TurnResult

# Groq/Llama sometimes emit a tool call in a non-JSON wrapper that Groq's own
# parser then rejects with `tool_use_failed`, handing back the raw text in
# `failed_generation`. The junk between the name and the JSON args varies wildly
# (nothing, a space, `=`, `>`, even `[]`), so we match everything up to the first
# `{`. Observed:
#   <function=open_skill{"name": "calculator"}</function>
#   <function=open_skill={"name": "calculator"}</function>
#   <function=calculator[]{"a": 128, "b": 47, "op": "multiply"}</function>
# We recover the intended call(s) from that text so the turn still works.
_FAILED_FN_RE = re.compile(r"<function=([A-Za-z0-9_]+)[^{]*(\{.*?\})", re.DOTALL)


def _parse_failed_generation(text: str) -> list[tuple[str, dict]]:
    calls = []
    for name, arg_str in _FAILED_FN_RE.findall(text or ""):
        try:
            calls.append((name, json.loads(arg_str)))
        except json.JSONDecodeError:
            continue
    return calls


class OpenAICompatSession(Session):
    def __init__(self, model, system):
        super().__init__(model, system)
        # Local (Ollama) needs no real key; send a placeholder so the header is valid.
        self.api_key = "ollama" if getattr(model, "local", False) else getattr(config, model.key_env, "")
        self.base_url = model.base_url.rstrip("/")
        self.messages: list[dict] = []
        if system:
            self.messages.append({"role": "system", "content": system})

    @staticmethod
    def _to_oai_tools(tools):
        return [
            {
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": t["input_schema"] or {"type": "object", "properties": {}},
                },
            }
            for t in tools
        ]

    def add_user(self, text: str) -> None:
        self.messages.append({"role": "user", "content": text})

    def add_assistant_text(self, text: str) -> None:
        self.messages.append({"role": "assistant", "content": text})

    def add_tool_result(self, tool_call_id: str, name: str, result_str: str) -> None:
        self.messages.append({
            "role": "tool",
            "tool_call_id": tool_call_id,
            "name": name,
            "content": result_str,
        })

    def step(self, tools):
        oai_tools = self._to_oai_tools(tools)
        payload = {
            "model": self.model.id,
            "messages": self.messages,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if oai_tools:
            payload["tools"] = oai_tools

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        text = ""
        thinking = ""
        usage = {}
        # tool calls arrive in fragments keyed by index; accumulate them.
        tool_acc: dict[int, dict] = {}

        with httpx.Client(timeout=120.0) as client:
            with client.stream(
                "POST", f"{self.base_url}/chat/completions",
                headers=headers, json=payload,
            ) as resp:
                resp.raise_for_status()
                for line in resp.iter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[len("data:"):].strip()
                    if data == "[DONE]":
                        break
                    chunk = json.loads(data)

                    # Provider-level error mid-stream (e.g. Groq tool_use_failed).
                    if chunk.get("error"):
                        err = chunk["error"] or {}
                        recovered = _parse_failed_generation(err.get("failed_generation", ""))
                        if recovered:
                            for i, (nm, parsed_args) in enumerate(recovered):
                                tool_acc[i] = {
                                    "id": f"call_recovered_{i}",
                                    "name": nm,
                                    "arguments": json.dumps(parsed_args),
                                }
                            break  # we salvaged the tool call(s); stop reading
                        fg = (err.get("failed_generation", "") or "")[:300]
                        raise RuntimeError(
                            (err.get("message", "provider returned an error"))
                            + (f" | failed_generation={fg!r}" if fg else ""))

                    if chunk.get("usage"):
                        u = chunk["usage"]
                        usage = {
                            "input_tokens": u.get("prompt_tokens"),
                            "output_tokens": u.get("completion_tokens"),
                        }

                    for choice in chunk.get("choices", []):
                        delta = choice.get("delta", {})
                        if delta.get("content"):
                            text += delta["content"]
                            yield {"type": "text", "text": delta["content"]}
                        # Reasoning stream, if the model exposes one. DeepSeek
                        # uses `reasoning_content`; Groq gpt-oss uses `reasoning`.
                        reasoning = delta.get("reasoning_content") or delta.get("reasoning")
                        if reasoning:
                            thinking += reasoning
                            yield {"type": "thinking", "text": reasoning}
                        for tc in delta.get("tool_calls", []):
                            idx = tc.get("index", 0)
                            slot = tool_acc.setdefault(
                                idx, {"id": "", "name": "", "arguments": ""})
                            if tc.get("id"):
                                slot["id"] = tc["id"]
                            fn = tc.get("function", {})
                            if fn.get("name"):
                                slot["name"] = fn["name"]
                            if fn.get("arguments"):
                                slot["arguments"] += fn["arguments"]

        # Build the assistant message to append to native history.
        assistant_msg: dict = {"role": "assistant", "content": text or None}
        ordered = [tool_acc[i] for i in sorted(tool_acc)]
        if ordered:
            assistant_msg["tool_calls"] = [
                {
                    "id": s["id"],
                    "type": "function",
                    "function": {"name": s["name"], "arguments": s["arguments"] or "{}"},
                }
                for s in ordered
            ]
        self.messages.append(assistant_msg)

        tool_calls = []
        for s in ordered:
            try:
                parsed = json.loads(s["arguments"] or "{}")
            except json.JSONDecodeError:
                # Surface the malformed args anyway — great learning material.
                parsed = {"__unparsed_arguments__": s["arguments"]}
            tool_calls.append(ToolCall(id=s["id"], name=s["name"], input=parsed))

        self.last_turn = TurnResult(
            text=text,
            thinking=thinking,
            tool_calls=tool_calls,
            stop_reason="tool_calls" if tool_calls else "stop",
            usage=usage,
        )
