# 🛠 Skill Playground

A local, chat-based tool for **learning how to build AI skills**. Chat with a
model, toggle skills on and off, and watch — in full detail — the moment the
model decides to call a skill, the exact arguments it sends to the skill's
script, what the script returns, and how the model uses the result.

It's not a production agent runtime. It's a teaching instrument: you learn by
editing real skills and watching the trace change.

## What you can do

- **Chat** with Claude (Anthropic) or Grok (xAI) — and DeepSeek if you add a key.
- **Toggle skills** per chat via checkboxes. Active skills become tools the model can call.
- **Watch skills light up** the instant the model calls them, with the script glowing while it runs.
- **Read the full trace** of every turn: reasoning → tool call (exact args) → script stdin/stdout/stderr/exit → result → final answer.
- **Compare models**: a prompt that works on a smart model may fail on a budget one. The trace shows you *why* — and what to fix.
- **Edit skills in the browser**: change a `SKILL.md` or its script, save to disk, re-run.
- **Ask the model "why did you do that?"** — it reads the turn's trace and coaches you on improving the skill.

## Setup

Requirements: Python 3.11+, Node 18+.

```bash
cd backend
cp .env.example .env        # then add at least one API key
```

Add a key to `backend/.env`:
- `ANTHROPIC_API_KEY` — Claude (exposes reasoning in the trace)
- `XAI_API_KEY` — Grok
- `DEEPSEEK_API_KEY` — DeepSeek (optional)

Only models whose key is present show up in the picker.

## Run

```bash
./run.sh
```

Then open **http://127.0.0.1:5173**. (The script starts the FastAPI backend on
:8000 and the Vite dev server on :5173, which proxies `/api` to the backend.)

To run the pieces separately:

```bash
# backend
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000
# frontend
cd frontend && npm run dev
```

## Project layout

```
skills/                 # each folder is one skill (auto-discovered)
  calculator/
    SKILL.md            # frontmatter (name, description, script, input_schema) + docs
    calculate.py        # the script: JSON in on stdin, JSON out on stdout
backend/                # FastAPI: skill loader, script runner, provider adapters, tool-use loop
  app/providers/        # anthropic (native) + openai_compat (Grok/DeepSeek)
frontend/               # React + Vite: chat, skills sidebar, trace timeline, editor
GUIDE.md                # how to build a skill, start here
```

See **[GUIDE.md](GUIDE.md)** to build your first skill, and
**[CURRICULUM.md](CURRICULUM.md)** for a progression of example skills to build
and learn from (including script-less "instruction only" skills).
