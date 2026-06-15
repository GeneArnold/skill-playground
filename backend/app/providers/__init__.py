"""Provider factory — maps a ModelInfo to the right Session implementation."""
from __future__ import annotations

from ..models import ModelInfo
from .anthropic_provider import AnthropicSession
from .base import Session, ToolCall, TurnResult
from .openai_compat import OpenAICompatSession

__all__ = ["make_session", "Session", "ToolCall", "TurnResult"]


def make_session(model: ModelInfo, system: str) -> Session:
    if model.provider == "anthropic":
        return AnthropicSession(model, system)
    if model.provider == "openai_compat":
        return OpenAICompatSession(model, system)
    raise ValueError(f"Unknown provider: {model.provider}")
