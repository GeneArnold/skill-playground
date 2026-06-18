#!/usr/bin/env python3
"""Tavily web search skill. JSON in on stdin, JSON out on stdout."""
import json
import os
import sys
import urllib.error
import urllib.request

args = json.loads(sys.stdin.read())
query = args.get("value") or args.get("query")
if not query:
    print("no search query provided", file=sys.stderr)
    sys.exit(1)

api_key = os.environ.get("TAVILY_API_KEY")
if not api_key:
    print("TAVILY_API_KEY is not set in backend/.env", file=sys.stderr)
    sys.exit(1)

payload = json.dumps({
    "query": query,
    "max_results": 5,
    "include_answer": True,
}).encode()

request = urllib.request.Request(
    "https://api.tavily.com/search",
    data=payload,
    method="POST",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    },
)

try:
    with urllib.request.urlopen(request, timeout=8) as response:
        data = json.loads(response.read())
except urllib.error.HTTPError as e:
    detail = e.read().decode(errors="replace")[:400]
    print(f"HTTP {e.code}: {detail}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)

# Trim to a compact result so the tool output isn't huge.
results = [
    {"title": r.get("title"), "url": r.get("url"), "content": r.get("content")}
    for r in data.get("results", [])
]
print(json.dumps({
    "query": query,
    "answer": data.get("answer"),
    "results": results,
}))
