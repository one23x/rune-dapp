---
name: Mockup sandbox screenshot quirk
description: Why the app_preview screenshot tool shows a 404 for /__mockup/ routes
---
The `app_preview` screenshot tool loads the MAIN app (port 5000). The mockup
sandbox is a separate Vite server exposed under the `/__mockup/` artifact preview
path. Requesting `/__mockup/preview/<folder>/<Component>` via `app_preview` renders
the main app's SPA catch-all 404 — NOT the mockup. This does NOT mean the mockup is
broken.

**Why:** the screenshot tool does not route through the artifact preview proxy.

**How to apply:** to verify a mockup renders, (1) trust the DESIGN subagent's own
screenshot (it has the sandbox screenshot mechanics), or (2) `curl` the URL and
confirm the HTML is the sandbox shell (`<title>Mockup Canvas</title>`,
`src="/__mockup/src/main.tsx"`). The canvas iframe renders the URL correctly even
though app_preview cannot.
