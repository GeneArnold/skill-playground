---
name: word_counter
description: >-
  Counts words, characters, and sentences in a piece of text. Use this when the
  user asks how long something is, how many words/characters/sentences a passage
  has, or asks you to measure or analyze the length of text they provide.
script: count.py
input_schema:
  type: object
  properties:
    text:
      type: string
      description: The text to analyze.
  required: [text]
---

# Word counter skill

A one-argument skill. Good for learning how the model decides to pass a large
chunk of text (the user's message) into a tool.

## Try this to learn

- Ask "how long is this paragraph?" and paste text. Watch the model copy your
  text into the `text` argument in the trace.
- Tighten the description so the model only uses it for *words* — then ask about
  characters and see if it still calls the skill.
