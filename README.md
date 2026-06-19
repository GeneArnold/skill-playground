# 🛠 Skill Playground

A local, chat-based tool for **learning how to build AI skills**. Chat with a
model, toggle skills on and off, and watch — in full detail — the moment the
model decides to use a skill, the exact arguments it sends to the skill's
script, what the script returns, and how the model uses the result.

It's not a production agent runtime. It's a teaching instrument: you learn by
editing real skills and watching the trace change.

## What you can do

- **Chat** with Claude (Anthropic), Groq, xAI (Grok), DeepSeek — or **local
  models via Ollama, fully offline**.
- **Toggle skills** per chat. Active skills are offered to the model; only their
  name + description are shown up front (progressive disclosure).
- **Watch skills light up** the instant the model opens/calls them, with the
  script glowing while it runs.
- **Read the full trace** of every turn: the system prompt sent, reasoning, the
  exact tool call (args), script stdin/stdout/stderr/exit, the result, and the
  final answer.
- **Step through a turn** ("📖 Walk through") — a replay scrubber that narrates
  each step and shows *what entered the model's context* and a running
  context-size estimate.
- **Edit skills in the browser** — a tabbed editor (Frontmatter / Instructions /
  Script) with syntax highlighting, a Markdown preview, and a YAML validator.
- **AI copilot** (✨ Assistant tab) — describe a script or paste an error and it
  writes/fixes the Python for you, keeping the input schema in sync. Works with
  any model, including local ones.
- **Edit the system prompt** ("📝 Instructions") — the model's standing orders.
- **Ask "why did you do that?"** — the model reads the turn's trace and coaches
  you on improving the skill.
- **Compare models** — a prompt that works on a smart model may fail on a budget
  one. The trace shows you *why*, and what to fix.
- **Stop** a run mid-stream; collapse/resize the side panels to taste.

## How a skill works (progressive disclosure)

A skill is a folder under `skills/`. Each has a `SKILL.md` (YAML frontmatter +
Markdown body) and, optionally, a script.

1. **Up front**, the model sees only each enabled skill's **name + description**
   — a lightweight menu — plus an `open_skill` tool. No bodies, no script tools.
2. When the model judges a skill relevant it calls **`open_skill(name)`**, which
   loads that skill's full instructions (the Markdown body) into context and
   reveals its script tool.
3. It then **calls the skill's tool**; the playground runs the script (JSON in on
   stdin, JSON out on stdout) and feeds the result back.

Skills don't need code — a **script-less skill** (just `name` + `description` +
instructions) shapes *how* the model responds (a persona, a format, a policy).

See **[GUIDE.md](GUIDE.md)** to build your first skill and **[CURRICULUM.md](CURRICULUM.md)**
for a progression of examples (including script-less "instruction only" skills).

## Setup

Requirements: Python 3.11+, Node 18+.

```bash
cd backend
cp .env.example .env        # then add at least one API key (or use Ollama)
```

Keys in `backend/.env` (only models whose key is present appear in the picker):
- `ANTHROPIC_API_KEY` — Claude (exposes reasoning in the trace)
- `GROQ_API_KEY` — Groq (fast hosted open models)
- `XAI_API_KEY` — xAI / Grok
- `DEEPSEEK_API_KEY` — DeepSeek
- `TAVILY_API_KEY` — only if you use the Tavily web-search skill

### Offline with Ollama (no key, no internet)

Install [Ollama](https://ollama.com) and pull a tool-capable model:

```bash
ollama pull qwen2.5:7b      # best all-rounder
ollama pull llama3.2        # tiny & fast
```

While the Ollama server is running, its models appear in the picker
automatically — no API key, works on a plane. (Gemma is skipped: it doesn't
support tool calling, which the playground needs.) Configure with
`OLLAMA_ENABLED` / `OLLAMA_BASE_URL` in `.env`.

## Run (development)

```bash
./run.sh
```

Open **http://127.0.0.1:5173**. The script starts FastAPI on :8000 and the Vite
dev server on :5173 (which proxies `/api` to the backend), and installs any
extra skill libraries (see below).

Run the pieces separately:

```bash
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000   # backend
cd frontend && npm run dev                                          # frontend
```

## Run with Docker (easiest for others)

One container builds the frontend and serves it together with the API.

```bash
cp backend/.env.example backend/.env   # optional: add keys (Ollama needs none)
docker compose up --build
```

Open **http://127.0.0.1:8000**.

**Talking to the host** (so local-style skills keep working):

- **Ollama** runs on your *host*; the container reaches it at
  `host.docker.internal` (preconfigured, with a Linux `host-gateway` fallback).
  Have Ollama running and its models appear automatically.
- **Skills** — `./skills` is bind-mounted, so editing skills in the UI (or
  dropping in new folders on the host) persists and survives rebuilds.
- **File-writing skills** (e.g. `local_document`) — `./documents` is mounted to
  `/app/documents`. Have the skill write under **`/app/documents/...`** and the
  files land in `./documents` on your host.

API keys come from `backend/.env` at runtime and are never baked into the image.

## Skills that need extra Python libraries

Skill scripts run with the **same Python that runs the backend**, so the standard
library is always available. If a skill needs a third-party package (e.g.
`requests`, `beautifulsoup4`):

1. Add it to **`skills/requirements.txt`**, one per line.
2. Install it:
   - **Local:** re-run `./run.sh` (it installs `skills/requirements.txt` into
     `backend/.venv`), or run
     `backend/.venv/bin/pip install -r skills/requirements.txt`.
   - **Docker:** rebuild with `docker compose up --build` — the package is
     installed into the image.
3. `import` it in your script as usual. The script contract is unchanged: JSON in
   on stdin, JSON out on stdout, exit 0 on success.

Example — a skill that uses `requests`:

```
# skills/requirements.txt
requests
```
```python
# skills/my-skill/run.py
import json, sys, requests
args = json.loads(sys.stdin.read())
r = requests.get(args["url"], timeout=8)
print(json.dumps({"status": r.status_code, "len": len(r.text)}))
```

> Tip: scripts can also reach **API keys / config from the environment** via
> `os.environ` (the subprocess inherits the backend's env, including `.env`).
> That's how the Tavily skill reads `TAVILY_API_KEY` instead of hardcoding it.

## How the conversation memory works

This is one of the best things to *see* in this tool, because it makes the
"context window" concrete.

- The model is **stateless between requests**. Every time you send a message, the
  frontend rebuilds the **entire transcript** — each prior (your message, the
  model's final answer) pair — and sends it *all* again plus your new message.
  That growing transcript **is** the context window.
- **Within a single turn** the context is larger still: the system prompt
  (your Instructions + the skill menu) + each **opened skill's full body** +
  every tool call and result, all accumulating through the tool-use loop. The
  **Walkthrough** ("📖 Walk through") shows this growth step by step.
- **Across turns**, only the visible user/assistant text carries forward —
  opened skill bodies and tool results from earlier turns are **not** replayed.
  So the model re-opens a skill each turn it needs it. (Smaller history, but the
  model doesn't "remember" it already opened a skill last turn.)
- **No persistence:** the conversation lives only in browser memory. A refresh,
  or **+ New chat**, clears it.
- **Token usage** for each turn (input → output) is shown in the Trace panel,
  reported by the provider. Each model has its own **context window**; when the
  transcript exceeds it the provider truncates or errors. This playground does
  **no** automatic summarization or trimming — that's a real production concern
  left out on purpose so you can watch raw context growth.

## Project layout

```
skills/                 # each folder is one skill (auto-discovered)
  calculator/
    SKILL.md            # frontmatter (name, description, script, input_schema) + body
    calculate.py        # the script: JSON in on stdin, JSON out on stdout
  requirements.txt      # extra Python libs your skills need
backend/                # FastAPI: skill loader, script runner, providers, tool-use loop
  app/providers/        # anthropic (native) + openai_compat (Groq/xAI/DeepSeek/Ollama)
frontend/               # React + Vite: chat, skills sidebar, trace, walkthrough, editor
Dockerfile              # multi-stage: build frontend, serve with the backend
docker-compose.yml      # host wiring (Ollama, skills + documents volumes, keys)
GUIDE.md                # how to build a skill — start here
CURRICULUM.md           # a progression of example skills to build and learn from
```
