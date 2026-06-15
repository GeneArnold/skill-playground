#!/usr/bin/env python3
"""Number stats skill. JSON in on stdin, JSON out on stdout.

Demonstrates an array-valued argument.
"""
import json
import statistics
import sys


def main() -> None:
    args = json.loads(sys.stdin.read())
    numbers = args["numbers"]

    if not numbers:
        print("numbers list is empty", file=sys.stderr)
        sys.exit(1)

    print(json.dumps({
        "count": len(numbers),
        "min": min(numbers),
        "max": max(numbers),
        "sum": sum(numbers),
        "mean": statistics.mean(numbers),
        "median": statistics.median(numbers),
    }))


if __name__ == "__main__":
    main()
