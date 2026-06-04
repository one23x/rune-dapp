---
name: Dual i18n systems
description: This repo has TWO independent translation systems with different key spaces and file formats — know which one a page uses before editing keys.
---

# Two independent i18n systems

1. **react-i18next** — `src/app/lib/i18n.ts` loads `src/app/locales/*.json` (12 langs:
   ar/de/en/es/fr/ja/ko/pt/ru/vi/zh/zh-TW). Used by the `/app` pages (profile,
   desktop-sidebar, strategy/smart-prediction, vault, etc.). Keys are dotted paths
   like `profile.overviewTab`, `strategy.smartPrediction.*`.
2. **language-context** — `src/contexts/language-context.tsx` imports `./i18n`
   (i.e. `src/contexts/i18n/*.ts`, namespace `mr.*` e.g. `mr.rune.*`). Used by the
   mainnet pages (layout, home, rune, projects, tools, resources, etc.). Consumed via
   `useLanguage()` / `n()` / `useShowZh()`.

**Why it matters:** the same concept can have a key in BOTH systems with different
paths; `src/contexts/i18n` is NOT dead even though nothing imports the string
"contexts/i18n" (it's imported relatively as `./i18n` from `language-context.tsx`).

## Safe bulk edits to the locale JSON
`JSON.stringify(JSON.parse(raw), null, 2) + "\n"` is **byte-identical** to the
existing `src/app/locales/*.json` files. So a Node script that parses, deletes
specific nested keys, and reserializes produces a diff containing ONLY the removed
keys (zero formatting churn) — the safe way to prune keys across all 12 files at once.
Watch out for same-named keys at different paths (e.g. top-level `profile.noNode`
vs kept `profile.team.noNode`) — delete by full path, not by leaf name.

## Known pre-existing quirk
`profile.overviewTab` renders as the raw key in the desktop sidebar even though the
key exists (value "Overview") and sibling keys resolve fine. Pre-existing, unrelated
to feature removals — don't chase it as a regression.
