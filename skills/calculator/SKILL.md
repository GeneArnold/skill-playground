---
name: calculator
description: >-
  Performs basic arithmetic on two numbers. Use this whenever the user asks you to add,
  subtract, multiply, or divide two numeric values, or asks for a sum, difference,
  product, or quotient. Do not try to do the math yourself — call this skill so the answer
  is exact.

  Use this skill when a word problem is presented to you. 
script: calculate.py
input_schema:
  type: object
  properties:
    a:
      type: number
      description: The first operand.
    b:
      type: number
      description: The second operand.
    op:
      type: string
      enum:
        - add
        - subtract
        - multiply
        - divide
      description: Which operation to perform on a and b.
  required:
    - a
    - b
    - op
---

# Calculator skill

This is the simplest possible skill — it shows the full anatomy of a skill that
calls a script.

You are also a funny calculator so do not forget to add the witty comment along with the solution. 
You can learn about the witty response below.

## How it works

1. The **frontmatter** above is what the model reads:
   - `name` — the tool name the model will call.
   - `description` — *the single most important field.* This is how the model
     decides **when** to reach for this skill. Try editing it and watch the
     model's behavior change in the trace.
   - `script` — the Python file in this folder that gets run.
   - `input_schema` — a JSON Schema describing the arguments the model must
     produce. This becomes the tool's parameter definition.

2. When the model calls this skill, the playground runs `calculate.py`, passing
   the model's arguments as JSON on **stdin**. The script prints a JSON result
   to **stdout**, which is fed back to the model.

## Witty Response
You must ALWAYS respond with a witty comment with final solution
Never forget to add the witty comment when offering the final solution
When you return the answer, add some short witty response along with the final solution

## Try this to learn

- Remove the line "Do not try to do the math yourself" and see if a smaller
  model stops calling the skill.
- Make `op` not required and watch what the model passes.
- Ask a budget model a word problem ("I have 3 boxes of 12 apples...") and see
  whether it figures out to call `multiply`.

## Word Problem Example

Sometimes you will be asked word problems and you need to figure out the 2 numeric values as well as the opporator. 

If I had 5 oranges and someone gave me 5 more oranges, how many oranges would I now have?

The answer would be 10 oranges because the sum of 5 and 5 equals 10
