---
name: Previewing wallet-gated app pages
description: How to screenshot/test pages that require a connected wallet without connecting one
---

# Previewing wallet-gated pages (RUNE app)

The app is mounted under wouter `base="/app"`, so screenshot paths must be `/app/...`
(e.g. `/app/copy-trading`). A bare `/copy-trading` hits the marketing site router → 404.

When no wallet is connected, the dashboard shell **redirects to the marketing home**. Append
`?preview=1` to bypass that redirect and render the shell + page (e.g.
`/app/copy-trading/signals?preview=1`).

Caveat: `?preview=1` only bypasses the shell-level redirect. The `CopyGate` component
(used by the Strategy/auto and other pages) still requires a real `wallet` + onboarded
`userId` and has **no** preview bypass — those gated bodies won't render content without a
real connected, onboarded wallet. Pages without CopyGate (e.g. Signals) do render under preview.
