#!/usr/bin/env python3
"""Word counter skill script. JSON in on stdin, JSON out on stdout."""
import json
import re
import sys


def main() -> None:
    args = json.loads(sys.stdin.read())
    text = args["text"]

    words = len(text.split())
    characters = len(text)
    characters_no_spaces = len(text.replace(" ", ""))
    sentences = len([s for s in re.split(r"[.!?]+", text) if s.strip()])

    print(json.dumps({
        "words": words,
        "characters": characters,
        "characters_no_spaces": characters_no_spaces,
        "sentences": sentences,
    }))


if __name__ == "__main__":
    main()
