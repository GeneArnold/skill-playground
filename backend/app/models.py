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
    local: bool = False  # local (Ollama) — no API key, gated on reachability


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
    # --- Ollama (local, offline) — only tool-capable models. base_url is filled
    # from config at availability time so OLLAMA_BASE_URL is respected.
    ModelInfo(
        id="qwen2.5:7b",
        label="Qwen2.5 7B (local)",
        provider="openai_compat",
        tier="smart",
        exposes_thinking=False,
        local=True,
    ),
    ModelInfo(
        id="llama3.2:latest",
        label="Llama 3.2 (local, tiny & fast)",
        provider="openai_compat",
        tier="budget",
        exposes_thinking=False,
        local=True,
    ),
    ModelInfo(
        id="gpt-oss:20b",
        label="GPT-OSS 20B (local, reasoning)",
        provider="openai_compat",
        tier="smart",
        exposes_thinking=True,
        local=True,
    ),
]


def _key_for(model: ModelInfo) -> str:
    if model.provider == "anthropic":
        return config.ANTHROPIC_API_KEY
    return getattr(config, model.key_env, "")


def _hydrate(model: ModelInfo) -> ModelInfo:
    """Local models get their base_url from config at lookup time."""
    if model.local and not model.base_url:
        model.base_url = config.OLLAMA_BASE_URL
    return model


def _ollama_reachable() -> bool:
    if not config.OLLAMA_ENABLED:
        return False
    try:
        import httpx
        httpx.get(f"{config.OLLAMA_BASE_URL}/models", timeout=0.6).raise_for_status()
        return True
    except Exception:  # noqa: BLE001 — server not running / not reachable
        return False


def available_models() -> list[ModelInfo]:
    """Models we can actually use: cloud models with a key, plus local (Ollama)
    models when the Ollama server is reachable."""
    ollama_up = _ollama_reachable()
    out = []
    for m in _CATALOG:
        if m.local:
            if ollama_up:
                out.append(_hydrate(m))
        elif _key_for(m):
            out.append(m)
    return out


def get_model(model_id: str) -> ModelInfo | None:
    for m in _CATALOG:
        if m.id == model_id:
            return _hydrate(m)
    return None
