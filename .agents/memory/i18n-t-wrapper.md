---
name: i18n t() argument-order gotcha
description: Why some t() calls render the raw key on screen, and the correct argument order for fallbacks + interpolation
---

# i18n `t()` fallback + interpolation argument order

The 3-arg form `t("some.key", { time: x }, "Fallback text")` is **broken** — when the key is
undefined it renders the raw key (e.g. `copyTrading.updatedAt`) instead of the fallback, because
i18next treats the 2nd arg as options and there's no `defaultValue` in it.

Correct forms:
- No interpolation: `t("key", "Fallback")` — works (2-arg).
- With interpolation: `t("key", "Fallback", { time: x })` (defaultValue as 2nd) **or**
  `t("key", { time: x, defaultValue: "Fallback" })`.

**Why:** several pre-existing copy-trading calls (`copyTrading.updatedAt`, `copyTrading.historyShowing`)
use the broken 3-arg order; they also trip a project-wide `tsc` type error on the `t()` overload.
**How to apply:** when adding interpolated translations, never put the options object before the
fallback string. If you see a raw `copyTrading.*` key on screen, this is the cause.
