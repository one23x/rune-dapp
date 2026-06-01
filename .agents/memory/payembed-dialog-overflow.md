---
name: PayEmbed overflow inside dialogs
description: thirdweb PayEmbed renders ~400px wide and its own overflow:hidden clips it inside narrow dialogs.
---

# PayEmbed overflow inside dialogs

thirdweb v5 `<PayEmbed modalSize="compact">` renders via `EmbedContainer`
(`react/web/ui/ConnectWallet/Modal/ConnectEmbed.js`) styled with
`width: modalMaxWidthCompact (400px); maxWidth: 100%; overflow: hidden`.
Inside a `max-w-sm` (384px) Dialog with default `p-6` padding the inner area is
only ~310px, so the embed's internal "Choose Payment Method" content (needs
~360px) gets hard-clipped on the right by EmbedContainer's own `overflow:hidden`.
An outer `overflow-x-auto` wrapper does NOT help — the clip happens *inside* the
embed, before the wrapper.

**Fix that works (both HL Arbitrum-USDC and pUSD Polygon deposit dialogs):**
1. Widen the dialog + cut padding: `DialogContent` →
   `w-[calc(100vw-0.75rem)] max-w-md p-3 ...` (gives ~354px inner on a 390px phone).
2. Full-bleed the embed to the dialog edges: wrapper `className="-mx-2 overflow-x-auto"`
   (cancels most of the `p-3`, ~370px), and drop the `overflow-hidden` on its
   parent so nothing double-clips.
3. Force the embed to its container: PayEmbed forwards `style`/`className` straight
   onto EmbedContainer, so pass `style={{ width: "100%" }}` (inline beats the
   emotion `width:400px`; `maxWidth:100%` then caps it to the container).

**Why:** Giving the embed ~370px (vs ~310) plus forcing `width:100%` lets
thirdweb's responsive compact layout fit without internal clipping.

**How to apply:** Any new deposit/funding dialog embedding PayEmbed needs all
three: wide dialog (`max-w-md p-3`), full-bleed `-mx-2` wrapper, and
`style={{ width:"100%" }}` on PayEmbed. Sites: `strategy/hl-copy-section.tsx`
`HlDepositBridge`, `copy-trading/shared.tsx` `DepositBridge`.
