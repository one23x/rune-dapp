/**
 * Native app-style node Overview — lean rewrite of the marketing dashboard's
 * `OverviewTab`. Keeps the functional skeleton (owned-tier hero, bound-to,
 * prediction code, buy CTA, a compact benefits summary) without slavishly
 * re-rendering the ~700-line marketing benefits/pool/genesis spec tables.
 *
 * Shared leaf hooks under `@/hooks/rune/*` keep the /app bundle decoupled
 * from the marketing `/dashboard` page module.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Sparkles, Copy, Check, ChevronRight, ExternalLink, Gift,
  Scale, Layers, Coins, Users, ShieldCheck,
} from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserPurchase } from "@/hooks/rune/use-node-presell";
import { usePersonalStats } from "@/hooks/rune/use-team";
import { useReferrerOf } from "@/hooks/rune/use-community";
import { usePredictionCode } from "@/hooks/rune/use-prediction-code";
import { NODE_META, type NodeId } from "@/lib/thirdweb/contracts";
import { runeChain } from "@/lib/thirdweb/chains";
import { emitOpenPurchase } from "@/lib/rune/purchase-signal";
import { copyText } from "@app/lib/copy";

const short = (a: string | undefined) => (!a ? "—" : `${a.slice(0, 6)}…${a.slice(-4)}`);

export function NodeOverviewPanel({ address }: { address: string }) {
  const { t } = useTranslation();
  const { nodeId: chainNodeId, hasPurchased: chainPurchased, isLoading } = useUserPurchase(address);
  const { data: stats } = usePersonalStats(address);
  const { referrer, isBound, isRoot } = useReferrerOf(address);
  const { data: codeRow } = usePredictionCode(address);

  const hasPurchased = chainPurchased || !!stats?.hasPurchased;
  const ownedNodeId = chainNodeId ?? stats?.ownedNodeId ?? null;
  const meta = ownedNodeId ? NODE_META[ownedNodeId as NodeId] : null;
  const code = codeRow?.code ?? null;

  const [copied, setCopied] = useState(false);
  async function copyCode() {
    if (!code) return;
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const explorer = runeChain.blockExplorers?.[0]?.url ?? "https://bscscan.com";

  const benefits = [
    { icon: Users,       title: t("profile.node.b.direct", "直推佣金"),  desc: t("profile.node.b.directD", "下级购买节点即时返佣") },
    { icon: Gift,        title: t("profile.node.b.airdrop", "节点空投"),  desc: t("profile.node.b.airdropD", "按层级批次发放代币空投") },
    { icon: Scale,       title: t("profile.node.b.weight", "权重分红"),   desc: t("profile.node.b.weightD", "按节点权重分配协议收益") },
    { icon: Coins,       title: t("profile.node.b.pool", "资金池分红"),   desc: t("profile.node.b.poolD", "全网资金池按比例派息") },
    { icon: Layers,      title: t("profile.node.b.streams", "多重收益"),  desc: t("profile.node.b.streamsD", "六大收益流叠加释放") },
    { icon: ShieldCheck, title: t("profile.node.b.platform", "平台权益"), desc: t("profile.node.b.platformD", "高阶功能与治理参与") },
  ];

  return (
    <div className="space-y-4">
      {/* Tier hero / buy CTA */}
      {meta ? (
        <Card className="border-amber-500/40 bg-card/50 glow-green-sm overflow-hidden relative">
          <motion.div className="pointer-events-none absolute -top-16 -right-12 h-48 w-48 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, rgba(${meta.rgb},0.22), transparent 70%)` }}
            animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} />
          <CardContent className="p-4 relative flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-[11px] font-mono uppercase tracking-[0.3em] ${meta.color}`}>{meta.nameEn}</p>
                <Badge variant="secondary" className="text-[10px] text-emerald-300">{t("profile.node.active", "已激活")}</Badge>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold leading-tight mt-1">
                <span className={meta.color} style={{ textShadow: `0 0 24px rgba(${meta.rgb},0.5)` }}>{meta.nameCn}</span>
                <span className="text-muted-foreground/60 text-base font-mono ml-2">#{ownedNodeId}</span>
              </h2>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("profile.node.paid", "持有价值")}</p>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums text-neon-value leading-none mt-1">
                ${meta.priceUsdt.toLocaleString("en-US")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">USDT</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <button type="button" onClick={() => emitOpenPurchase()} disabled={isLoading}
          className="group w-full rounded-2xl py-4 px-5 flex items-center gap-3 text-left text-white shadow-[0_12px_30px_-12px_rgba(251,191,36,0.55)] transition-shadow disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#f59e0b,#ea580c)", border: "1px solid rgba(251,191,36,0.45)" }}
          data-testid="button-buy-node">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-base font-bold">{t("profile.node.buy", "购买节点")}</span>
            <span className="block text-[12px] text-white/85 mt-0.5">{t("profile.node.buySub", "激活节点解锁全部权益与收益")}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Bound-to */}
      <Card className="premium-card border-border">
        <CardContent className="p-3 flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("profile.node.boundTo", "上级")}</span>
          <span className="text-xs">
            {isRoot ? (
              <span className="text-amber-300 font-semibold">ROOT</span>
            ) : isBound && referrer ? (
              <a href={`${explorer}/address/${referrer}`} target="_blank" rel="noreferrer"
                className="font-mono text-foreground hover:text-amber-400 inline-flex items-center gap-1 transition-colors">
                {short(referrer)} <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            ) : (
              <span className="text-muted-foreground">{t("profile.node.notBound", "未绑定")}</span>
            )}
          </span>
        </CardContent>
      </Card>

      {/* Prediction code — only for owners that have a code assigned */}
      {hasPurchased && code && (
        <Card className="border-amber-500/30 bg-card/50">
          <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-300/85">
              <Sparkles className="h-3 w-3 text-amber-300" /> {t("profile.node.predCode", "智能预测码")}
            </span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-sm font-semibold text-amber-200 tracking-wider truncate select-all" data-testid="text-prediction-code">{code}</span>
              <button type="button" onClick={copyCode}
                className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-all ${
                  copied ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                }`} aria-label={t("profile.node.copyCode", "复制预测码")}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? t("profile.node.copied", "已复制") : t("profile.node.copy", "复制")}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Benefits summary — compact cards, not the full marketing spec tables */}
      <div>
        <h3 className="text-sm font-bold mb-2.5 flex items-center gap-1.5">
          <Gift className="h-4 w-4 text-amber-400" /> {t("profile.node.benefits", "节点权益")}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05, ease: EASE }}
              whileHover={{ y: -3 }}
              className="premium-card group relative overflow-hidden rounded-xl p-3"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_80%_-20%,rgba(251,191,36,0.12),transparent_55%)]" />
              <div className="relative flex items-center gap-2 mb-1">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-amber-400/40"
                  style={{ background: "linear-gradient(135deg,rgba(251,191,36,0.28),rgba(180,90,10,0.14))" }}>
                  <b.icon className="h-3.5 w-3.5 text-amber-200" />
                </div>
                <span className="text-[12px] font-bold truncate">{b.title}</span>
              </div>
              <p className="relative text-[11px] text-muted-foreground leading-snug">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/80 text-center">
        {t("profile.node.note", "权益与收益按链上节点等级实时结算")}
      </p>
    </div>
  );
}
