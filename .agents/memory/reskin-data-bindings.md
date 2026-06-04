---
name: Reskin subagents may hardcode placeholder values
description: After delegating a visual reskin/port of a data-wired component, re-verify live data bindings — subagents tend to bake the mockup's fake numbers into the JSX.
---

When a GENERAL subagent reskins/exact-ports a data-wired component to match a static mockup, it can replace a LIVE binding with the mockup's hardcoded placeholder value (e.g. a hero number rendered as literal `$0.00` instead of `<AnimUsdt value={totalEarnings} />`). The component still renders and passes LSP, so the regression is silent.

**Why:** The mockup files use hardcoded display values; a subagent copying the mockup's look can copy its literals too, dropping the real `t()`/query/derived binding underneath.

**How to apply:** After any delegated reskin/port, grep the touched files for suspicious literals (`$0`, `0 FIRE`, fixed percentages) and confirm each headline/number is still bound to the real computed value or hook. Run an architect `evaluate_task` review with `includeGitDiff: true` focused on "data wiring preserved" — it reliably catches these.
