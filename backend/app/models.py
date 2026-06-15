"""Registry of selectable models, grouped by provider.

Only models whose provider has an API key set are offered to the UI. Each entry
notes whether the provider exposes the model's reasoning ("thinking") so the
trace view can set expectations.
"""
from dataclasses import dataclass

from . import config


@dataclass
class ModelInfo:
    id: str            # the model id sent to the provider API
    label: str         # human label shown in the picker
    provider: str      # "anthropic" | "openai_compat"
    tier: str          # "smart" | "budget" — a learning hint, not exact
    exposes_thinking: bool
    # For openai_compat providers we also need a base_url + which key to use.
    base_url: str = ""
    key_env: str = ""


# The full catalog. Filtered at runtime by available keys.
_CATALOG = [
    ModelInfo(
        id="claude-opus-4-8",
        label="Claude Opus 4.8 (smart)",
        provider="anthropic",
        tier="smart",
        exposes_thinking=True,
    ),
    ModelInfo(
        id="claude-haiku-4-5-20251001",
        label="Claude Haiku 4.5 (budget)",
        provider="anthropic",
        tier="budget",
        exposes_thinking=False,
    ),
    ModelInfo(
        id="grok-3",
        label="Grok 3 (xAI)",
        provider="openai_compat",
        tier="smart",
        exposes_thinking=False,
        base_url="https://api.x.ai/v1",
        key_env="XAI_API_KEY",
    ),
    ModelInfo(
        id="grok-3-mini",
        label="Grok 3 mini (xAI, budget)",
        provider="openai_compat",
        tier="budget",
        exposes_thinking=False,
        base_url="https://api.x.ai/v1",
        key_env="XAI_API_KEY",
    ),
    # --- Groq (groq.com) — fast inference host for open models, OpenAI-compatible.
    ModelInfo(
        id="llama-3.3-70b-versatile",
        label="Llama 3.3 70B (Groq, smart)",
        provider="openai_compat",
        tier="smart",
        exposes_thinking=False,
        base_url="https://api.groq.com/openai/v1",
        key_env="GROQ_API_KEY",
    ),
    ModelInfo(
        id="llama-3.1-8b-instant",
        label="Llama 3.1 8B (Groq, budget)",
        provider="openai_compat",
        tier="budget",
        exposes_thinking=False,
        base_url="https://api.groq.com/openai/v1",
        key_env="GROQ_API_KEY",
    ),
    ModelInfo(
        id="openai/gpt-oss-20b",
        label="GPT-OSS 20B (Groq, reasoning)",
        provider="openai_compat",
        tier="budget",
        exposes_thinking=True,
        base_url="https://api.groq.com/openai/v1",
        key_env="GROQ_API_KEY",
    ),
    ModelInfo(
        id="deepseek-chat",
        label="DeepSeek Chat (budget)",
        provider="openai_compat",
        tier="budget",
        exposes_thinking=False,
        base_url="https://api.deepseek.com",
        key_env="DEEPSEEK_API_KEY",
    ),
]


def _key_for(model: ModelInfo) -> str:
    if model.provider == "anthropic":
        return config.ANTHROPIC_API_KEY
    return getattr(config, model.key_env, "")


def available_models() -> list[ModelInfo]:
    """Return only the models we have a key for."""
    return [m for m in _CATALOG if _key_for(m)]


def get_model(model_id: str) -> ModelInfo | None:
    for m in _CATALOG:
        if m.id == model_id:
            return m
    return None
