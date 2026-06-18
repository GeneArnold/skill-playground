#!/usr/bin/env python3
"""JSON in on stdin, JSON out on stdout."""
import json, sys
import urllib.request, urllib.parse

args = json.loads(sys.stdin.read())
query = args['value']
api_key = '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'  # replace with your actual Tavily API key

url = f'https://search.tavily.com/search?q={urllib.parse.quote(query)}'
request = urllib.request.Request(url)
request.add_header('Authorization', f'Bearer {api_key}')
request.add_header('Content-Type', 'application/json')

try:
    response = urllib.request.urlopen(request)
    data = response.read()
    print(json.dumps(json.loads(data)))
except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)