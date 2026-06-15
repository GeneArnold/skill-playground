#!/usr/bin/env python3
"""Text reverser skill script. JSON in on stdin, JSON out on stdout."""
import json
import sys


def main() -> None:
    args = json.loads(sys.stdin.read())
    text = args["text"]
    mode = args.get("mode", "characters")

    if mode == "words":
        reversed_text = " ".join(reversed(text.split()))
    else:
        reversed_text = text[::-1]

    print(json.dumps({"reversed": reversed_text, "mode": mode}))


if __name__ == "__main__":
    main()
