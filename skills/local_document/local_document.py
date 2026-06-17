#!/usr/bin/env python3
"""JSON in on stdin, JSON out on stdout."""
import json, sys

args = json.loads(sys.stdin.read())
try:
    with open(f"{args['doc_location']}/{args['doc_name']}", 'w') as file:
        file.write(args['doc_content'])
    print(json.dumps({"success": True, "message": f"Document {args['doc_name']} saved to {args['doc_location']}"}))
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)