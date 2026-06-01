---
name: Canvas applyCanvasActions update payload
description: The exact payload shape for update vs create actions in applyCanvasActions
---

`applyCanvasActions` create and update actions use DIFFERENT payload keys.

- **create**: `{ type: "create", shapeId, shape: { type, x, y, w, h, ... } }` — the payload key is `shape`, and the shape type goes in `shape.type`.
- **update**: `{ type: "update", shapeId, updates: { shapeType, ...fieldsToPatch } }` — the payload key is `updates` (NOT `shape`), AND it MUST include `shapeType` (e.g. "iframe", "geo", "text", "note", "image", "video") or it errors with "Update actions require 'shapeType' in 'updates'".

**Why:** Cost 3 failed attempts toggling an iframe's `state` from "building" to "live" because update was called with `shape:` then `updates:{state}` without `shapeType`.

**How to apply:** To flip a mockup iframe placeholder to live: `{ type:"update", shapeId, updates:{ shapeType:"iframe", state:"live" } }`.
