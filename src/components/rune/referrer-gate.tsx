import { useEffect, useState } from "react";
import {
  useActiveAccount, useActiveWallet, useDisconnect, useSendTransaction,
} from "thirdweb/react";
import { prepareContractCall, waitForReceipt, readContract } from "thirdweb";
import { Loader2, AlertCircle, UserPlus, Link2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { communityContract, COMMUNITY_ROOT } from "@/lib/thirdweb/contracts";
import { runeChain } from "@/lib/thirdweb/chains";
import { thirdwebClient } from "@/lib/thirdweb/client";
import { useReferrerOf } from "@/hooks/rune/use-community";
import { useReferralParam } from "@/hooks/rune/use-referral-param";

/**
 * Global referral gate. On wallet connect we read `Community.referrerOf(self)`:
 *   - already bound  → render nothing (user may proceed / enter dashboard).
 *   - NOT bound      → force a non-dismissible modal to bind a referrer.
 *       · referrer is prefilled from the `?ref=0x…` invite link (persisted in
 *         localStorage so it survives navigation), and editable.
 *       · "绑定" → validates the referrer is in-community (referrerOf(ref)!=0 or
 *         ROOT) then sends `addReferrer(ref)` for the user to sign.
 *       · closing / cancelling the modal WITHOUT binding disconnects the wallet
 *         (per spec: no bind, no entry).
 * Mounted once, globally, under the thirdweb provider.
 */

const ZERO = "0x0000000000000000000000000000000000000000";
const REF_KEY = "rune_ref";

export function ReferrerGate() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { mutateAsync: sendTx } = useSendTransaction();

  const refQ = useReferrerOf(account?.address);
  const urlRef = useReferralParam(account?.address);

  const [refInput, setRefInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Persist the invite-link ref so it survives navigation to the connect step.
  useEffect(() => {
    if (urlRef) { try { localStorage.setItem(REF_KEY, urlRef); } catch { /* ignore */ } }
  }, [urlRef]);

  // Prefill the input from the URL ref or the persisted one.
  useEffect(() => {
    if (refInput) return;
    let stored: string | null = null;
    try { stored = localStorage.getItem(REF_KEY); } catch { /* ignore */ }
    const seed = urlRef ?? stored;
    if (seed) setRefInput(seed);
  }, [urlRef, refInput]);

  // Only gate once the on-chain read has actually resolved (avoid a flash
  // while `referrerOf` is in flight, which would otherwise read as unbound).
  const settled = !!account && (refQ as any).isFetched === true && !refQ.isLoading;
  const needsBind = settled && refQ.isBound === false;

  if (!needsBind) return null;

  async function bind() {
    setErr(null);
    const ref = refInput.trim().toLowerCase();
    if (!/^0x[0-9a-fA-F]{40}$/.test(ref)) { setErr("邀请人地址格式不正确"); return; }
    if (account && ref === account.address.toLowerCase()) { setErr("推荐人不能是自己"); return; }
    setBusy(true);
    try {
      // Per 对接文档 §3.2: referrer must already be in the community
      // (referrerOf(ref) != 0) unless it's ROOT.
      if (ref !== COMMUNITY_ROOT.toLowerCase()) {
        const upline = await readContract({
          contract: communityContract,
          method: "function referrerOf(address) view returns (address)",
          params: [ref],
        });
        if (!upline || (upline as string).toLowerCase() === ZERO) {
          setErr("该邀请人尚未加入社区,无法作为推荐人");
          setBusy(false);
          return;
        }
      }
      const tx = prepareContractCall({
        contract: communityContract,
        method: "function addReferrer(address referrer_)",
        params: [ref as `0x${string}`],
      });
      const res = await sendTx(tx);
      await waitForReceipt({ client: thirdwebClient, chain: runeChain, transactionHash: res.transactionHash });
      try { localStorage.removeItem(REF_KEY); } catch { /* ignore */ }
      await refQ.refetch?.();
    } catch (e: any) {
      const m = String(e?.message ?? e);
      if (/Referrer exists/i.test(m)) { await refQ.refetch?.(); }
      else if (/Referrer is yourself/i.test(m)) setErr("推荐人不能是自己");
      else if (/Referrer not invited/i.test(m)) setErr("该邀请人尚未加入社区,无法作为推荐人");
      else if (/rejected|denied|User rejected/i.test(m)) setErr("你取消了签名");
      else setErr(m.slice(0, 140));
    } finally {
      setBusy(false);
    }
  }

  function cancelAndDisconnect() {
    if (wallet) disconnect(wallet);
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) cancelAndDisconnect(); }}>
      <DialogContent
        className="bg-card border-border max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 grid place-items-center shrink-0">
              <UserPlus className="h-4 w-4 text-black" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] font-bold leading-tight">绑定推荐人</DialogTitle>
              <DialogDescription className="text-[12px] leading-tight">
                进入前需先在链上绑定推荐人(每个钱包仅一次)。
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" /> 推荐人地址
          </div>
          <Input
            value={refInput}
            onChange={(e) => { setRefInput(e.target.value); setErr(null); }}
            placeholder="0x… 邀请人地址(来自邀请链接 ?ref=)"
            className="bg-background/50 border-border text-sm font-mono"
            disabled={busy}
          />
          {err && (
            <p className="text-[12px] text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {err}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            推荐人须已加入社区。绑定后才能购买节点 / 进入面板。关闭此窗口将断开钱包。
          </p>
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={cancelAndDisconnect}>
            取消并断开
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 border-amber-500/50 text-black font-bold"
            disabled={busy || !refInput.trim()}
            onClick={bind}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认绑定"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ReferrerGate;
