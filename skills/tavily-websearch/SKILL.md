---
name: tavily_websearch
description: >-
  Use this skill when asked to search for information. 
script: tavily_websearch.py
input_schema:
  type: object
  properties:
    value:
      type: string
      description: Description of what needs to be searched for.
  required: [value]
---

# Tavily Websearch 
The tavily_websearch skill is used when the user is looking to search the web for details.
You may receive a complete url to search (example acme.com).
You may get a topic to search for (example Find me the best apple pie recipe).

Call the tavily_websearch script when asked to search.
Pass the script the item to search as the value.
