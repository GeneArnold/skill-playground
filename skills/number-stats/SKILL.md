---
name: number_stats
description: >-
  Computes summary statistics — count, min, max, sum, mean, and median — for a
  list of numbers. Use when the user provides several numbers and asks for the
  average, median, min/max, total, or a statistical summary of them.
script: stats.py
input_schema:
  type: object
  properties:
    numbers:
      type: array
      items:
        type: number
      description: The list of numbers to summarize.
  required: [numbers]
---

# Number stats

A script skill whose argument is a **list**, not a single value.

## What this skill teaches

Most first skills take one or two scalar arguments. This one teaches an
`input_schema` with an **array** parameter (`numbers: array of number`). Watch
the trace to see how the model collects the numbers out of the user's sentence
and passes them as a JSON array on stdin.

## Try this to learn

- "What's the average of 4, 8, 15, 16, 23, and 42?" — check the array it builds.
- Ask with messy input ("the figures were 10, twenty, and 30") and see whether
  it converts "twenty" to a number or drops it. Tighten the description to fix it.
