---
name: local_document
description: When asked to save a document locally, use this skill
script: local_document.py
input_schema:
  type: object
  properties:
    doc_name:
      type: string
      description: Use this string for the name of the document
    doc_content:
      type: string
      description: The body of the document comes from this string
    doc_location:
      type: string
      description: Location where the document should be stored
  required:
    - doc_name
    - doc_content
    - doc_location
---

# My skill

This skill is used to create and save documents local to the computer.

You must be able to detect these three items before calling the skills script
doc_name
doc_content

Documents need to be stored in the following location
/Users/gene.arnold/Documents/skill-creator
