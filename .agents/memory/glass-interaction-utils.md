---
name: iOS glass interaction utilities
description: Global liquid-glass tactile utilities and the reduced-motion convention for Framer Motion in this app.
---

# iOS liquid-glass interaction layer

The global glass foundation lives at the very bottom of `src/app/index.css` (appended last so it wins over Tailwind + earlier tokens).

- `.glass-panel` / `.glass-panel-strong` are the base surfaces. They now carry a **top specular sheen** (a layered `linear-gradient` in `background` before the `--glass-bg`), `position: relative`, and a spring-eased `transition` on transform/box-shadow/border-color. Because they are `position: relative`, absolutely-positioned children (e.g. injected `.shimmer-sweep`) anchor to the panel — intended.
- Opt-in tactile utilities (apply to clickable elements): `.glass-interactive` (hover lift + active press), `.tap-press` (quick scale-down on `:active`), `.glass-sheen` (a gliding diagonal gloss — drop as an absolute child inside a `relative overflow-hidden` panel).
- A `@media (prefers-reduced-motion: reduce)` block disables all of the above CSS transitions/animations.

**Reduced-motion convention — important:** there is **no global `<MotionConfig reducedMotion>`** wrapper in the app shell. So any Framer Motion component that adds `whileTap` / `whileHover` / spring `layout` transitions must gate them itself with `useReducedMotion()` (see `dashboard-sub-tabs.tsx` and `page-enter.tsx` for the pattern). CSS-only effects are already handled by the media query above.

**Why:** the design direction is iOS "liquid glass" (GOLD+BLACK). Centralizing depth/sheen on the two base panel classes propagates polish to every page without per-file edits; the opt-in classes avoid making non-interactive panels respond to hover.
