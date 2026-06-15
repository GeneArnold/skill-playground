#!/usr/bin/env python3
"""Calculator skill script.

Contract (the same for every skill in this playground):
  - Read a single JSON object from stdin  -> the arguments the model produced.
  - Print a single JSON object to stdout   -> the result fed back to the model.
  - Exit 0 on success, non-zero on error (stderr is captured into the trace).

This stub is intentionally tiny. Edit it, break it, fix it — the trace view
will show you exactly what the model sent in and what you sent back.
"""
import json
import sys


def main() -> None:
    raw = sys.stdin.read()
    args = json.loads(raw)

    a = args["a"]
    b = args["b"]
    op = args["op"]

    if op == "add":
        result = a + b
    elif op == "subtract":
        result = a - b
    elif op == "multiply":
        result = a * b
    elif op == "divide":
        if b == 0:
            print("cannot divide by zero", file=sys.stderr)
            sys.exit(1)
        result = a / b
    else:
        print(f"unknown op: {op}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps({"result": result, "expression": f"{a} {op} {b}"}))


if __name__ == "__main__":
    main()
