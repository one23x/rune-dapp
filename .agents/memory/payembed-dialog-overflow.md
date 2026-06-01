---
name: PayEmbed overflow inside dialogs
description: thirdweb PayEmbed has a fixed min-width that overflows narrow dialogs unless wrapped.
---

# PayEmbed overflow inside dialogs

thirdweb's `<PayEmbed>` renders at a fixed/min width (~360–400px) that overflows
a `max-w-sm` Dialog on mobile. Always wrap it so the popup stays responsive:

```jsx
<div className="overflow-hidden rounded-xl w-full">
  <div className="w-full overflow-x-auto">
    <PayEmbed ... />
  </div>
</div>
```

**Why:** The HL (Arbitrum USDC) deposit dialog had this wrapper; the Polymarket
pUSD deposit dialog (copy-trading/shared.tsx DepositBridge) did not, so its
PayEmbed overflowed — user reported "充值弹窗没改好".

**How to apply:** Any new deposit/funding dialog embedding PayEmbed needs the
`w-full` + inner `overflow-x-auto` wrapper. Both HL and pUSD deposit dialogs now use it.
