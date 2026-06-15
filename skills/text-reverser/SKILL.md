---
name: text_reverser
description: >-
  Reverses text. Can reverse the whole string character-by-character, or reverse
  the order of the words. Use when the user asks to reverse, flip, or mirror some
  text, or asks what something looks like backwards.
script: reverse.py
input_schema:
  type: object
  properties:
    text:
      type: string
      description: The text to reverse.
    mode:
      type: string
      enum: [characters, words]
      description: Reverse individual characters, or the order of the words.
      default: characters
  required: [text]
---

# Text reverser skill

Shows an optional argument with a default (`mode`). A nice one for learning how
clearly you have to describe an enum so the model picks the right value.

## Try this to learn

- Ask "reverse the words in 'the quick brown fox'" and check whether the model
  sets `mode: words` — if it doesn't, the description needs work.
