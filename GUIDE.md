# How to build a skill

A **skill** is a folder under `skills/`. The playground discovers it
automatically — drop a folder in (or click **+ New** in the UI) and it appears.

A skill has two parts:

1. **`SKILL.md`** — what the *model* reads.
2. **A script** (e.g. `calculate.py`) — the code that *runs* when the model calls the skill.

## 1. The `SKILL.md`

```markdown
---
name: calculator
description: >-
  Performs basic arithmetic on two numbers. Use this whenever the user asks you
  to add, subtract, multiply, or divide two numeric values.
script: calculate.py
input_schema:
  type: object
  properties:
    a: { type: number, description: The first operand. }
    b: { type: number, description: The second operand. }
    op:
      type: string
      enum: [add, subtract, multiply, divide]
  required: [a, b, op]
---

# Calculator skill
Instructions for the model — how to use the skill, the rules, examples.
```

A `SKILL.md` has **two zones** separated by the `---` fences:

- **Frontmatter** (the YAML on top) — structured config the program parses.
- **Body** (the Markdown below) — the instruction set. When the model *opens* a
  skill (progressive disclosure — see below), this text is loaded into its
  context, so **this is where you shape behavior**. If a skill isn't doing what
  you want, edit the body (the *how*) or the `description` (the *when*).

### Progressive disclosure (how skills are really used)

The model does **not** get every skill's full instructions up front. Instead:

1. It sees only each skill's **name + description** (a lightweight index) plus an
   `open_skill` tool.
2. When it judges a skill relevant, it calls `open_skill(name)` — which loads
   that skill's body into context and reveals its script tool.
3. From then on, that skill stays in context for the conversation.

This keeps context small: enable as many skills as you like; only the ones the
model actually opens cost anything. Watch it happen in the **Trace** panel.

> 💡 The app has a built-in **"📖 How it works"** button (top bar) with the full
> walkthrough, including how the model uses a skill end-to-end.

The **frontmatter** fields:

| Field | What it does |
|-------|--------------|
| `name` | The tool name the model calls. Use `snake_case`. |
| `description` | **The most important field.** This is how the model decides *when* to use the skill. Vague description → the model won't call it, or calls it at the wrong time. |
| `script` | The file in this folder that runs when the skill is called. |
| `input_schema` | A [JSON Schema](https://json-schema.org/) describing the arguments. This becomes the tool's parameters; it tells the model exactly what to pass. |

## 2. The script

The contract is the same for every skill:

- Read **one JSON object** from **stdin** — these are the arguments the model produced.
- Print **one JSON object** to **stdout** — this is the result fed back to the model.
- Exit `0` on success; exit non-zero and write to **stderr** on error (the trace shows it).

```python
#!/usr/bin/env python3
import json, sys

args = json.loads(sys.stdin.read())   # e.g. {"a": 3, "b": 4, "op": "add"}
result = args["a"] + args["b"]
print(json.dumps({"result": result}))
```

## The learning loop

1. Toggle your skill **on** in the sidebar.
2. Ask the model something that should trigger it.
3. Watch the **trace panel** (right): did it call the skill? With the right
   arguments? Did the script succeed?
4. If not — **edit the description or schema**, save, and try again.
5. Stuck? Hit **💡 Explain why** on the answer and let the model coach you.

## Things to try

- **Weaken a description** and watch a budget model stop calling the skill.
- **Run the same prompt on Opus vs. Haiku/Grok-mini.** Compare the traces. A
  smart model often infers intent a budget model misses — so the budget model
  needs a more explicit description or a clearer schema.
- **Make a script crash** (raise an error) and see how the model reacts to the
  error result fed back to it.
- **Add an optional argument with a default** and see whether the model sets it.

That's the whole game: the skill is just a description + a schema + a script,
and you learn by watching exactly what the model does with them.
