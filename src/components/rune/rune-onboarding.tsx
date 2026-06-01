import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useLocation } from "wouter";
import { BindReferrerModal } from "./bind-referrer-modal";
import { PurchaseNodeModal } from "./purchase-node-modal";
import { useReferralParam } from "@/hooks/rune/use-referral-param";
import { useReferrerOf } from "@/hooks/rune/use-community";
import { useUserPurchase } from "@/hooks/rune/use-node-presell";
import { onOpenPurchase } from "@/lib/rune/purchase-signal";
import { useDemoStore } from "@/lib/demo-store";
import type { NodeId } from "@/lib/thirdweb/contracts";

/**
 * Sole piece of onboarding glue. Mounted once in App.tsx.
 *
 * Flow (revised 2026-05-20 — bind is now a hard gate):
 *   1. Wallet connects → read `referrerOf` and `getUserPurchaseData`.
 *   2. Not bound → BindReferrerModal opens and stays open. The user has
 *      exactly two paths forward: bind a referrer (→ step 3), or click
 *      the explicit "断开钱包" button inside the modal (→ wallet
 *      disconnects, modal closes, UI returns to the unauthenticated
 *      "Connect Wallet" state). Esc / outside-click / X are disabled so
 *      a connected-but-unbound wallet cannot silently browse the app.
 *      Pre-fills the input from `?ref=` if present.
 *   3. Bound (purchased OR not) → navigate to /dashboard. The dashboard
 *      itself surfaces the referral relationship + invite link to every
 *      bound user; an unpurchased user gets a NoNodeReminder popup there
 *      explaining commission eligibility still requires owning a node,
 *      with a CTA that fires `emitOpenPurchase`.
 *   4. PurchaseNodeModal stays mounted to listen for the explicit open
 *      signal from card CTAs / dashboard reminder / nav buttons.
 *
 * Each decision re-checks on-chain state after every tx so reloads
 * mid-flow land the user on the correct step.
 */
export function RuneOnboarding() {
  const account = useActiveAccount();
  const { isDemoMode } = useDemoStore();
  const address = account?.address;
  const [location, navigate] = useLocation();

  const refFromUrl = useReferralParam(address);
  const { referrer, isBound, refetch: refetchReferrer } = useReferrerOf(address);
  const { hasPurchased, isLoading: purchaseLoading, refetch: refetchPurchase } = useUserPurchase(address);

  const [bindOpen, setBindOpen] = useState(false);
  const [buyOpen, setBuyOpen]   = useState(false);
  const [preSelectedNodeId, setPreSelectedNodeId] = useState<NodeId | undefined>();
  // BuyModal stays dismissable per session. The dismissed flag prevents
  // the effect below from snapping it back open during the brief window
  // between `setOpen(false)` and the contract state update propagating.
  // Without it, a Radix Dialog open→close→open micro-cycle leaves the
  // page with a lingering body `pointer-events: none` that requires a
  // refresh to clear. BindModal no longer needs this — it's hard-gated
  // and the only "out" is wallet disconnect (which drops `address` to
  // undefined, naturally closing the modal).
  const [buyDismissed, setBuyDismissed] = useState(false);
  // Post-bind landing-page redirect should fire ONCE per wallet session.
  // sessionStorage-backed because the dashboard logo is a plain <a href="/">
  // that does a full page reload to escape wouter's base="/app" router;
  // React state alone resets across that reload and re-triggers the
  // redirect, trapping the user on /app/profile.
  const redirectKey = address ? `postBindRedirected:${address.toLowerCase()}` : null;
  const [postBindRedirected, setPostBindRedirected] = useState<boolean>(() => {
    if (typeof window === "undefined" || !redirectKey) return false;
    return window.sessionStorage.getItem(redirectKey) === "1";
  });

  useEffect(() => {
    setBuyDismissed(false);
    // Wallet disconnect → close the bind modal (covers the explicit
    // "断开钱包" button path inside BindReferrerModal).
    if (!address) setBindOpen(false);
    if (typeof window === "undefined") {
      setPostBindRedirected(false);
      return;
    }
    setPostBindRedirected(
      redirectKey ? window.sessionStorage.getItem(redirectKey) === "1" : false,
    );
  }, [address, redirectKey]);

  // When the wallet disconnects, kick the user out of the dashboard back
  // to the marketing home so the disconnected state isn't visible inside
  // a member-only surface. Demo mode is exempt (it bypasses real auth).
  useEffect(() => {
    if (isDemoMode) return;
    // Design-preview bypass: /app/...?preview=1 lets us view member-only
    // surfaces without a connected wallet. Skip the kick-out-to-marketing.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("preview")) return;
    if (address) return;
    if (location === "/app" || location.startsWith("/app/")) {
      navigate("/");
    }
  }, [address, location, isDemoMode, navigate]);

  // Re-open signal from outside (card clicks, nav clicks).
  // Optionally carries a specific nodeId to pre-select in the modal.
  useEffect(() => onOpenPurchase((nodeId) => {
    if (isDemoMode) return;
    setPreSelectedNodeId(nodeId);
    setBuyDismissed(false);
    setBuyOpen(true);
  }), [isDemoMode]);

  useEffect(() => {
    // Demo mode bypasses all onboarding gates — the /demo page handles entry.
    if (isDemoMode) return;
    if (!address || referrer === undefined || purchaseLoading) return;

    // Not bound — hard gate. The modal stays open until the user either
    // binds a referrer (success path) or explicitly clicks the
    // "断开钱包" button inside the modal. There's no third path: Esc,
    // outside-click, and the X are all disabled inside the modal.
    if (!isBound) {
      setBindOpen(true);
      setBuyOpen(false);
      return;
    }

    // Bound (purchased OR not) — proceed to /app/profile, but ONLY when the
    // user is currently sitting on an onboarding/landing surface. Otherwise
    // this effect runs on every page mount and steals navigation away from
    // any link the user just clicked (e.g. clicking 「查看分析」 on /app/vault
    // would land on /projects/rune for one tick, then this effect would
    // immediately punt them back to /app/profile). Restricting to landing
    // pages preserves the post-bind redirect on first connect while letting
    // bound users freely navigate content pages afterwards.
    const ONBOARDING_PATHS = new Set(["/", "/recruit", "/dashboard"]);
    if (isBound && !postBindRedirected && ONBOARDING_PATHS.has(location)) {
      setPostBindRedirected(true);
      if (typeof window !== "undefined" && redirectKey) {
        window.sessionStorage.setItem(redirectKey, "1");
      }
      navigate("/app/profile");
      return;
    }
  }, [address, referrer, isBound, hasPurchased, purchaseLoading, navigate, location, postBindRedirected, redirectKey]);

  return (
    <>
      <BindReferrerModal
        open={bindOpen}
        initialReferrer={refFromUrl}
        // Bind is a hard gate now (2026-05-20) — the modal has no
        // dismiss path. It only closes when (a) `onBound` fires after a
        // successful tx, or (b) the user clicks the explicit "断开钱包"
        // button inside the modal, which disconnects the wallet and
        // causes the effect above to flip `bindOpen` back to false via
        // the `!address` branch.
        onBound={async () => {
          setBindOpen(false);
          await refetchReferrer();
          // Effect will navigate to /dashboard on the next render once
          // isBound flips true; the dashboard's NoNodeReminder takes over
          // from there for unpurchased users.
        }}
      />
      <PurchaseNodeModal
        open={buyOpen}
        initialNodeId={preSelectedNodeId}
        onClose={() => { setBuyOpen(false); setBuyDismissed(true); setPreSelectedNodeId(undefined); }}
        onSkip={() => {
          setBuyOpen(false);
          setBuyDismissed(true);
          setPreSelectedNodeId(undefined);
        }}
        onPurchased={async () => {
          setBuyOpen(false);
          setPreSelectedNodeId(undefined);
          await refetchPurchase();
          navigate("/app/profile");
        }}
      />
    </>
  );
}
