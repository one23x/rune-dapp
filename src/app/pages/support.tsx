import { useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useActiveAccount } from "thirdweb/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LifeBuoy, Send, Inbox, Paperclip, X, ChevronLeft, Wallet, Loader2,
  CheckCircle2, Clock, CircleDot, Archive, ImageIcon,
} from "lucide-react";
import { PageEnter } from "@app/components/page-enter";
import { DashboardSubTabs, type SubTabItem } from "@app/components/dashboard-sub-tabs";
import { supabase, w } from "@app/lib/supabase-client";
import { useToast } from "@app/hooks/use-toast";
import { runeChain } from "@/lib/thirdweb/chains";
import { WalletConnectButton } from "@/components/rune/wallet-connect-button";

const CHAIN_ID = runeChain.id;
const BUCKET = "ticket-attachments";

// Must match the storage bucket's allowed_mime_types / file_size_limit (support_tickets.sql).
// SVG intentionally excluded (script-in-svg vector); 5MB cap.
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
const ACCEPT_ATTR = ACCEPTED_MIME.join(",");
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type View = "create" | "list";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketCategory =
  | "deposit" | "withdraw" | "copy_trade" | "node_tier"
  | "wallet" | "vault" | "account_data" | "other";

interface Attachment { path: string; url: string; name: string }

interface Ticket {
  id: string;
  chain_id: number;
  wallet: string;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: string;
  attachments: Attachment[];
  contact: string | null;
  created_at: string;
  updated_at: string;
  last_reply_at: string | null;
  last_reply_by: string | null;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender: "user" | "admin";
  body: string;
  attachments: Attachment[];
  created_at: string;
}

const CATEGORIES: TicketCategory[] = [
  "deposit", "withdraw", "copy_trade", "node_tier",
  "wallet", "vault", "account_data", "other",
];

const STATUS_STEPS: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

function statusMeta(status: TicketStatus) {
  switch (status) {
    case "open":        return { color: "text-amber-300",   bg: "bg-amber-500/15 border-amber-500/30",   icon: CircleDot };
    case "in_progress": return { color: "text-sky-300",     bg: "bg-sky-500/15 border-sky-500/30",       icon: Clock };
    case "resolved":    return { color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/30", icon: CheckCircle2 };
    case "closed":      return { color: "text-white/50",    bg: "bg-white/10 border-white/15",           icon: Archive };
  }
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

/* ─────────────────────────── Create ticket form ─────────────────────────── */

function CreateTicketView({ wallet, onCreated }: { wallet: string; onCreated: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<TicketCategory>("deposit");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [contact, setContact] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const wrongType = incoming.filter((f) => !(ACCEPTED_MIME as readonly string[]).includes(f.type));
    const tooBig = incoming.filter(
      (f) => (ACCEPTED_MIME as readonly string[]).includes(f.type) && f.size > MAX_FILE_BYTES,
    );
    if (wrongType.length) {
      toast({
        title: t("support.toastFileTypeTitle", "不支持的文件类型"),
        description: t("support.toastFileTypeDesc", "仅支持 PNG / JPG / WebP / GIF 图片"),
        variant: "destructive",
      });
    }
    if (tooBig.length) {
      toast({
        title: t("support.toastFileSizeTitle", "图片过大"),
        description: t("support.toastFileSizeDesc", "单张图片不能超过 5MB"),
        variant: "destructive",
      });
    }
    const next = incoming.filter(
      (f) => (ACCEPTED_MIME as readonly string[]).includes(f.type) && f.size <= MAX_FILE_BYTES,
    );
    if (next.length) setFiles((prev) => [...prev, ...next].slice(0, 6));
  };
  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const canSubmit = subject.trim().length > 0 && description.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // 1) Insert the ticket first so we have its id for the storage path.
      const { data: inserted, error: insErr } = await supabase
        .from("support_tickets")
        .insert({
          chain_id: CHAIN_ID,
          wallet: w(wallet),
          category,
          subject: subject.trim(),
          description: description.trim(),
          contact: contact.trim() || null,
          attachments: [],
        })
        .select("id")
        .single();
      if (insErr || !inserted) throw insErr ?? new Error("insert failed");
      const ticketId = inserted.id as string;

      // 2) Upload screenshots → {chain_id}/{wallet}/{ticket_id}/{filename}
      const attachments: Attachment[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${CHAIN_ID}/${w(wallet)}/${ticketId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) continue; // best-effort: a failed image shouldn't lose the ticket
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        attachments.push({ path, url: pub.publicUrl, name: file.name });
      }

      // 3) Persist attachment URLs onto the ticket if any uploaded.
      if (attachments.length) {
        await supabase.from("support_tickets").update({ attachments }).eq("id", ticketId);
      }

      toast({
        title: t("support.toastCreatedTitle", "工单已提交"),
        description: t("support.toastCreatedDesc", "我们会尽快跟进,你可在「我的工单」查看进度"),
      });
      setSubject(""); setDescription(""); setContact(""); setFiles([]); setCategory("deposit");
      onCreated();
    } catch (err: any) {
      toast({
        title: t("support.toastErrorTitle", "提交失败"),
        description: err?.message ?? t("support.toastErrorDesc", "请稍后重试"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Wallet (read-only) */}
      <div className="glass-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={14} className="text-amber-400" />
          <span className="text-xs font-medium text-white/70">{t("support.walletLabel", "工单钱包")}</span>
        </div>
        <div className="font-mono text-[11px] text-white/60 break-all bg-black/30 border border-white/10 rounded-lg px-3 py-2">
          {w(wallet)}
        </div>
        <div className="mt-1.5 text-[10px] text-white/35">{t("support.walletNote", "已自动关联当前连接的钱包")}</div>
      </div>

      {/* Category */}
      <div className="glass-panel p-4">
        <label className="block text-xs font-medium text-white/70 mb-2">{t("support.categoryLabel", "问题类型")}</label>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-lg border px-3 py-2.5 text-[12px] font-medium text-left transition-colors ${
                  active
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                    : "border-white/10 bg-black/20 text-white/60 hover:border-white/25"
                }`}
                data-testid={`support-cat-${c}`}
              >
                {t(`support.cat.${c}`, c)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subject + description */}
      <div className="glass-panel p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">{t("support.subjectLabel", "标题")}</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={120}
            placeholder={t("support.subjectPlaceholder", "一句话描述问题")}
            className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:border-amber-500/40 focus:outline-none"
            data-testid="support-subject"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">{t("support.descriptionLabel", "详细描述")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder={t("support.descriptionPlaceholder", "请尽量描述清楚发生了什么、涉及的金额/币种/时间等")}
            className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:border-amber-500/40 focus:outline-none resize-none"
            data-testid="support-description"
          />
        </div>
      </div>

      {/* Screenshots */}
      <div className="glass-panel p-4">
        <label className="block text-xs font-medium text-white/70 mb-2">{t("support.screenshotLabel", "截图(可选)")}</label>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
          data-testid="support-file-input"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-white/20 bg-black/20 px-4 py-2.5 text-xs text-white/70 hover:border-amber-500/40 transition-colors"
        >
          <Paperclip size={14} /> {t("support.addScreenshot", "添加截图")}
        </button>
        {files.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/40">
                <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white/80 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact */}
      <div className="glass-panel p-4">
        <label className="block text-xs font-medium text-white/70 mb-1.5">{t("support.contactLabel", "联系方式(可选)")}</label>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={120}
          placeholder={t("support.contactPlaceholder", "Telegram / 邮箱,方便我们联系你")}
          className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:border-amber-500/40 focus:outline-none"
          data-testid="support-contact"
        />
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className={`w-full h-12 rounded-lg font-bold text-sm inline-flex items-center justify-center gap-2 transition-all ${
          canSubmit
            ? "text-black shadow-[0_0_24px_rgba(245,158,11,0.3)] hover:-translate-y-0.5"
            : "text-white/40 border border-white/10 bg-white/[0.03] cursor-not-allowed"
        }`}
        style={canSubmit ? { background: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 50%, #d97706 100%)" } : undefined}
        data-testid="support-submit"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {t("support.submitBtn", "提交工单")}
      </button>
    </div>
  );
}

/* ─────────────────────────── Status timeline ─────────────────────────── */

function StatusTimeline({ status }: { status: TicketStatus }) {
  const { t } = useTranslation();
  // closed sits at the tail; resolved/closed both light the full path.
  const activeIdx = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center">
      {STATUS_STEPS.map((s, i) => {
        const reached = i <= activeIdx;
        const meta = statusMeta(s);
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${reached ? meta.bg : "border-white/10 bg-black/20"}`}>
                <meta.icon size={12} className={reached ? meta.color : "text-white/25"} />
              </div>
              <span className={`text-[8px] font-medium tracking-wide whitespace-nowrap ${reached ? "text-white/70" : "text-white/30"}`}>
                {t(`support.status.${s}`, s)}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 mb-4 ${i < activeIdx ? "bg-amber-400/50" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Ticket detail (thread) ─────────────────────────── */

function TicketDetail({ ticket, wallet, onBack }: { ticket: Ticket; wallet: string; onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");

  const messagesQ = useQuery({
    queryKey: ["support-messages", ticket.id],
    queryFn: async (): Promise<TicketMessage[]> => {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TicketMessage[];
    },
    refetchInterval: 20000,
  });

  const replyMut = useMutation({
    mutationFn: async (body: string) => {
      const { error: msgErr } = await supabase
        .from("support_ticket_messages")
        .insert({ ticket_id: ticket.id, sender: "user", body, attachments: [] });
      if (msgErr) throw msgErr;
      // Bump reply markers only. `status` is admin-only (anon lacks column GRANT),
      // so we do NOT flip status here; the admin panel treats last_reply_by='user'
      // as the "needs attention" signal and reopens/triages on its side.
      await supabase
        .from("support_tickets")
        .update({
          last_reply_at: new Date().toISOString(),
          last_reply_by: "user",
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);
    },
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["support-messages", ticket.id] });
      qc.invalidateQueries({ queryKey: ["support-tickets", wallet] });
    },
    onError: (err: any) =>
      toast({ title: t("support.toastErrorTitle", "提交失败"), description: err?.message, variant: "destructive" }),
  });

  const meta = statusMeta(ticket.status);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white/90 transition-colors"
        data-testid="support-detail-back"
      >
        <ChevronLeft size={14} /> {t("support.backToList", "返回工单列表")}
      </button>

      {/* Ticket header card */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] text-amber-300/80 font-medium uppercase tracking-wide mb-0.5">
              {t(`support.cat.${ticket.category}`, ticket.category)}
            </div>
            <h3 className="text-sm font-bold text-white/90 leading-snug break-words">{ticket.subject}</h3>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${meta.bg} ${meta.color}`}>
            <meta.icon size={11} /> {t(`support.status.${ticket.status}`, ticket.status)}
          </span>
        </div>
        <p className="text-[12px] text-white/60 leading-relaxed whitespace-pre-wrap break-words">{ticket.description}</p>
        {ticket.attachments?.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {ticket.attachments.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/40">
                <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}
        <div className="text-[10px] text-white/35">{fmtTime(ticket.created_at)}</div>
        <div className="pt-2 border-t border-white/8">
          <StatusTimeline status={ticket.status} />
        </div>
      </div>

      {/* Message thread */}
      <div className="space-y-2.5">
        {messagesQ.isLoading ? (
          <div className="text-center text-xs text-white/40 py-6">{t("common.loading", "加载中…")}</div>
        ) : (messagesQ.data ?? []).length === 0 ? (
          <div className="text-center text-xs text-white/35 py-4">{t("support.noMessages", "暂无回复,我们会尽快处理")}</div>
        ) : (
          messagesQ.data!.map((m) => {
            const isUser = m.sender === "user";
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
                    isUser
                      ? "bg-amber-500/15 border border-amber-500/25 rounded-br-sm"
                      : "bg-white/[0.05] border border-white/10 rounded-bl-sm"
                  }`}
                >
                  <div className={`text-[9px] font-semibold uppercase tracking-wide mb-1 ${isUser ? "text-amber-300/80" : "text-sky-300/80"}`}>
                    {isUser ? t("support.you", "我") : t("support.team", "客服")}
                  </div>
                  <div className="text-[12.5px] text-white/85 leading-relaxed whitespace-pre-wrap break-words">{m.body}</div>
                  <div className="text-[9px] text-white/30 mt-1 text-right">{fmtTime(m.created_at)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply box */}
      <div className="glass-panel p-3 sticky bottom-20 lg:bottom-4">
        <div className="flex items-end gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={t("support.replyPlaceholder", "补充信息或回复客服…")}
            className="flex-1 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white/90 placeholder:text-white/30 focus:border-amber-500/40 focus:outline-none resize-none"
            data-testid="support-reply-input"
          />
          <button
            type="button"
            disabled={!reply.trim() || replyMut.isPending}
            onClick={() => replyMut.mutate(reply.trim())}
            className={`shrink-0 h-10 w-10 rounded-lg inline-flex items-center justify-center ${
              reply.trim() && !replyMut.isPending
                ? "text-black"
                : "text-white/30 border border-white/10 bg-white/[0.03] cursor-not-allowed"
            }`}
            style={reply.trim() && !replyMut.isPending ? { background: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 60%, #d97706 100%)" } : undefined}
            data-testid="support-reply-send"
          >
            {replyMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── My tickets list ─────────────────────────── */

function TicketList({ wallet }: { wallet: string }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Ticket | null>(null);

  const ticketsQ = useQuery({
    queryKey: ["support-tickets", w(wallet)],
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("wallet", w(wallet))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
    refetchInterval: 30000,
  });

  if (selected) {
    // Keep the selected row fresh from the latest query result.
    const live = (ticketsQ.data ?? []).find((x) => x.id === selected.id) ?? selected;
    return <TicketDetail ticket={live} wallet={wallet} onBack={() => setSelected(null)} />;
  }

  if (ticketsQ.isLoading) {
    return <div className="text-center text-xs text-white/40 py-10">{t("common.loading", "加载中…")}</div>;
  }

  const tickets = ticketsQ.data ?? [];
  if (tickets.length === 0) {
    return (
      <div className="glass-panel p-8 text-center">
        <Inbox className="mx-auto mb-3 text-white/30" size={32} />
        <div className="text-sm text-white/60">{t("support.emptyTitle", "还没有工单")}</div>
        <div className="text-xs text-white/35 mt-1">{t("support.emptyDesc", "在「提交工单」标签中创建你的第一条工单")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {tickets.map((ticket) => {
        const meta = statusMeta(ticket.status);
        return (
          <button
            key={ticket.id}
            onClick={() => setSelected(ticket)}
            className="w-full text-left glass-panel p-4 hover:border-amber-500/25 transition-colors"
            data-testid={`support-ticket-${ticket.id}`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-[10px] text-amber-300/80 font-medium uppercase tracking-wide">
                {t(`support.cat.${ticket.category}`, ticket.category)}
              </span>
              <span className={`shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                <meta.icon size={10} /> {t(`support.status.${ticket.status}`, ticket.status)}
              </span>
            </div>
            <div className="text-sm font-semibold text-white/90 leading-snug break-words mb-1">{ticket.subject}</div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-white/35">{fmtTime(ticket.created_at)}</span>
              <div className="flex items-center gap-2">
                {ticket.attachments?.length > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-white/40">
                    <ImageIcon size={10} /> {ticket.attachments.length}
                  </span>
                )}
                {ticket.last_reply_by === "admin" && (
                  <span className="text-[9px] font-semibold text-sky-300">{t("support.newReply", "客服已回复")}</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export default function SupportPage() {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const account = useActiveAccount();
  const wallet = account?.address ?? "";
  const isConnected = !!wallet;
  const [view, setView] = useState<View>("create");

  const tabs: ReadonlyArray<SubTabItem<View>> = useMemo(() => [
    { key: "create", icon: Send, labelKey: "support.tabCreate", fallback: "提交工单" },
    { key: "list",   icon: Inbox, labelKey: "support.tabList",   fallback: "我的工单" },
  ], []);

  return (
    <PageEnter>
      <div className="relative pb-24 lg:pb-8 px-4 lg:px-6" data-testid="page-support">
        {/* Header — matches the dapp glass-tile idiom */}
        <header className="pt-6 pb-5 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg shrink-0">
              <LifeBuoy className="text-amber-200" size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight gold-text drop-shadow-md leading-tight">
                {t("support.pageTitle", "工单中心")}
              </h1>
              <p className="text-xs text-white/70 truncate">{t("support.pageSubtitle", "提交问题并追踪处理进度")}</p>
            </div>
          </div>
        </header>

        {!isConnected ? (
          <div className="glass-panel p-8 text-center mt-6">
            <Wallet className="mx-auto mb-3 text-white/30" size={32} />
            <div className="text-sm text-white/70 mb-1">{t("support.connectTitle", "请先连接钱包")}</div>
            <div className="text-xs text-white/40 mb-5">{t("support.connectDesc", "连接钱包后即可提交工单并查看进度")}</div>
            <div className="flex justify-center [&_button]:!h-11 [&_button]:!px-8 [&_button]:!text-sm [&_button]:!rounded-lg">
              <WalletConnectButton />
            </div>
          </div>
        ) : (
          <main className="relative z-10 space-y-4">
            <DashboardSubTabs<View> tabs={tabs} active={view} onChange={setView} testIdPrefix="support-tab" />
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {view === "create" ? (
                  <CreateTicketView wallet={wallet} onCreated={() => setView("list")} />
                ) : (
                  <TicketList wallet={wallet} />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        )}
      </div>
    </PageEnter>
  );
}
