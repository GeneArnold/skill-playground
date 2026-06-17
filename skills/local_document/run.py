#!/usr/bin/env python3
"""JSON in on stdin, JSON out on stdout."""
import json, sys

args = json.loads(sys.stdin.read())
# TODO: do something with args
print(json.dumps({"echo": args}))
