# Skill-building curriculum

A progression of skills designed to **teach how skills work** — not to be useful
products. Each one isolates a single concept. The ones marked ✅ ship with the
playground (in `skills/`); the rest are suggested builds (use **+ New**).

The golden rule while learning: after each skill, open the **Trace** panel and
ask *"did the model open it? call it right? why / why not?"*

---

## Tier 1 — A skill is just instructions (no script)

These have **no code**. They prove that a skill is fundamentally a set of
instructions that shapes *how* the model responds — a "social skill."

| Skill | Concept it teaches |
|-------|--------------------|
| ✅ `eli5` | A skill can change **format/style** (explain simply) with zero code. |
| ✅ `pirate_mode` | A skill can be a **persona / tone of voice**. |
| ✅ `socratic_tutor` | A skill can encode a **behavior policy**, including what *not* to do. |
| `formal_email` | Rewrite the user's text in a professional tone — a rewriting style skill. |
| `devils_advocate` | Always argue the opposing side — another behavioral skill. |
| `emoji_summary` | Summarize anything as 3 emoji + one line — format constraint. |

**Lessons:** the `description` decides *when* the model reaches for the skill;
the body decides *how* it behaves. Edit the body and watch behavior shift.

## Tier 2 — A skill that runs code (basic scripts)

A script: JSON in on stdin, JSON out on stdout. Start with scalar arguments.

| Skill | Concept it teaches |
|-------|--------------------|
| ✅ `calculator` | The full anatomy: frontmatter + script + a `required` enum argument. |
| ✅ `word_counter` | A single string argument; passing the user's text into a tool. |
| ✅ `text_reverser` | An **optional** argument with a default and an `enum`. |
| `coin_flip` / `dice_roll` | A skill that takes **no meaningful input** and returns a result. |
| `temperature_converter` | Two enums (from-unit, to-unit) + a number — schema design. |

## Tier 3 — Richer input schemas

| Skill | Concept it teaches |
|-------|--------------------|
| ✅ `number_stats` | An **array** argument (list of numbers). |
| `date_difference` | Two date strings; teaches string formats + validation. |
| `to_do_sorter` | An array of objects (task + priority) — nested schema. |

## Tier 4 — Failure & robustness (learn by breaking)

| Skill | Concept it teaches |
|-------|--------------------|
| `divider` | Deliberately error on divide-by-zero; see the error fed back to the model and how it reacts. |
| `strict_json` | A script that rejects bad input; teaches stderr + exit codes in the trace. |
| `ambiguous_skill` | Give it a vague `description` on purpose, then watch the model call it at the wrong time — then fix the description. |

## Tier 5 — When NOT to use a skill, and model differences

Not new skills, but exercises with the ones above:

- Enable several skills and ask something unrelated — does the model correctly
  open **none** of them? (Progressive disclosure means unused skills cost nothing.)
- Run the same prompt on a **smart** vs **budget** model and compare traces.
  Weaker models need firmer descriptions and instructions.
- Ask a question two ways (clear vs. messy) and see which makes the model open
  the right skill with the right arguments.

---

### How to build one

Click **+ New** in the sidebar. Fill the **Frontmatter** (name + description; add
`script:` and `input_schema` only if it runs code), the **Instructions** (the
behavior/how-to), and the **Script** if any. Save, enable it, and chat.

A script-less skill needs only `name` and `description` in its frontmatter — no
`script`, no `input_schema`.
