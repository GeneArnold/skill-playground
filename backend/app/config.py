"""Central configuration, loaded from environment / .env."""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env sitting next to the backend/ folder.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
XAI_API_KEY = os.getenv("XAI_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()

SKILLS_DIR = (_BACKEND_DIR / os.getenv("SKILLS_DIR", "../skills")).resolve()
SCRIPT_TIMEOUT_SECONDS = int(os.getenv("SCRIPT_TIMEOUT_SECONDS", "10"))

# Where the editable base system prompt ("Instructions") is stored.
INSTRUCTIONS_FILE = _BACKEND_DIR / "system_instructions.txt"
