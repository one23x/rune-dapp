import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronUp, Zap, Shield, TrendingUp, FlaskConical, X, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetRuneOverview } from "@/lib/queries";
import { useShowZh, useT, type Language } from "@/contexts/language-context";

/** Compact per-locale string map. Pages that have their own one-off
 *  copy bag carry these inline rather than blow out the shared
 *  dictionary. */
type LocaleMap = Partial<Record<Language, string>>;
import { useActiveAccount } from "thirdweb/react";
import { useNodeConfigs, useUserPurchase } from "@/hooks/rune/use-node-presell";
import { NODE_IDS, NODE_META, type NodeId } from "@/lib/thirdweb/contracts";
import { useReferrerOf } from "@/hooks/rune/use-community";
import { emitOpenPurchase } from "@/lib/rune/purchase-signal";
import { useDemoStore } from "@/lib/demo-store";

/** Map the REST response's tier key to the on-chain nodeId.
 *  101 is the apex (FOUNDER 50k); 501 is the entry tier (INITIAL 1k). */
const LEVEL_TO_NODE_ID: Record<string, NodeId> = {
  founder:  101,
  super:    201,
  advanced: 301,
  mid:      401,
  initial:  501,
};

/** Card render order — entry tier first (cheapest left, apex right). */
const TIER_ORDER: readonly NodeId[] = [501, 401, 301, 201, 101] as const;

/** Off-chain marketing metadata that REST normally supplies. Baked
 *  client-side too so we still render all 5 cards if the api-server is
 *  stale or returns fewer nodes. Values come from 节点招募计划. */
type TierStatic = {
  privatePrice: number;
  dailyUsdt:    number;
  airdropPerSeat: number;
  seats:        number;
};
const TIER_STATIC: Record<NodeId, TierStatic> = {
  101: { privatePrice: 0.016, dailyUsdt: 234,  airdropPerSeat: 75000, seats:   20 },
  201: { privatePrice: 0.020, dailyUsdt: 46.8, airdropPerSeat: 13000, seats:  200 },
  301: { privatePrice: 0.024, dailyUsdt: 23.4, airdropPerSeat:  6250, seats:  400 },
  401: { privatePrice: 0.026, dailyUsdt: 11.7, airdropPerSeat:  3000, seats:  800 },
  501: { privatePrice: 0.028, dailyUsdt:  4.7, airdropPerSeat:  1000, seats: 1000 },
};

/** Shape of one element returned by NodePresell.getNodeConfigs.
 *  `directRate` is in basis points (10000 = 100%). */
interface OnChainNodeConfig {
  nodeId: bigint;
  payToken: string;
  payAmount: bigint;
  maxLimit: bigint;
  curNum: bigint;
  directRate: bigint;
}

// ─── Node style maps ────────────────────────────────────────────────────────
const NODE_BG: Record<string, string> = {
  initial:  "from-[#0c1624] to-[#08111e] border-zinc-500/40",
  mid:      "from-[#0c1624] to-[#08111e] border-zinc-500/40",
  advanced: "from-[#0c1624] to-[#08111e] border-zinc-500/40",
  super:    "from-[#0c1624] to-[#08111e] border-amber-400/50",
  founder:  "from-[#0c1624] to-[#08111e] border-zinc-500/40",
};
const NODE_ACCENT: Record<string, string> = {
  initial:  "text-amber-400",
  mid:      "text-amber-400",
  advanced: "text-amber-400",
  super:    "text-amber-300",
  founder:  "text-amber-400",
};
const NODE_BADGE: Record<string, string> = {
  initial:  "bg-zinc-800/70 text-zinc-300 border-zinc-600/50",
  mid:      "bg-zinc-800/70 text-zinc-300 border-zinc-600/50",
  advanced: "bg-zinc-800/70 text-zinc-300 border-zinc-600/50",
  super:    "bg-amber-900/50 text-amber-200 border-amber-500/50 shadow-[0_0_8px_rgba(251,191,36,0.2)]",
  founder:  "bg-zinc-800/70 text-zinc-300 border-zinc-600/50",
};
const NODE_BTN: Record<string, string> = {
  initial:  "bg-amber-500/85 hover:bg-amber-400 text-black font-bold shadow-[0_0_18px_rgba(251,191,36,0.3)]",
  mid:      "bg-amber-500/85 hover:bg-amber-400 text-black font-bold shadow-[0_0_18px_rgba(251,191,36,0.3)]",
  advanced: "bg-amber-500/85 hover:bg-amber-400 text-black font-bold shadow-[0_0_18px_rgba(251,191,36,0.3)]",
  super:    "bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-[0_0_24px_rgba(251,191,36,0.5)]",
  founder:  "bg-amber-500/85 hover:bg-amber-400 text-black font-bold shadow-[0_0_18px_rgba(251,191,36,0.3)]",
};
const NODE_GLOW: Record<string, string> = {
  initial:  "shadow-[0_2px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.10)]",
  mid:      "shadow-[0_2px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.10)]",
  advanced: "shadow-[0_2px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.10)]",
  super:    "shadow-[0_2px_40px_rgba(251,191,36,0.18),inset_0_1px_0_rgba(251,191,36,0.12)]",
  founder:  "shadow-[0_2px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.10)]",
};
const NODE_PROGRESS_BAR: Record<string, string> = {
  initial:  "[&>div]:bg-gradient-to-r [&>div]:from-amber-600/70 [&>div]:to-amber-400/70",
  mid:      "[&>div]:bg-gradient-to-r [&>div]:from-amber-600/70 [&>div]:to-amber-400/70",
  advanced: "[&>div]:bg-gradient-to-r [&>div]:from-amber-600/70 [&>div]:to-amber-400/70",
  super:    "[&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-amber-300",
  founder:  "[&>div]:bg-gradient-to-r [&>div]:from-amber-600/70 [&>div]:to-amber-400/70",
};
const NODE_TOP_GLOW: Record<string, string> = {
  initial:  "from-zinc-300/35 to-transparent",
  mid:      "from-zinc-300/35 to-transparent",
  advanced: "from-zinc-300/35 to-transparent",
  super:    "from-amber-300/60 to-transparent",
  founder:  "from-zinc-300/35 to-transparent",
};

interface FaqItem { q: LocaleMap; a: LocaleMap }
const FAQ_ITEMS: FaqItem[] = [
  {
    q: {
      en: "How are node funds used?",
      zh: "节点购买资金如何使用？",
      "zh-TW": "節點購買資金如何使用？",
      ja: "ノード購入資金はどのように使われますか？",
      ko: "노드 구매 자금은 어떻게 사용되나요?",
      th: "เงินทุนจากการซื้อโหนดถูกนำไปใช้อย่างไร?",
      vi: "Quỹ từ việc mua node được sử dụng thế nào?",
    },
    a: {
      en: "Funds are allocated: 40% to TLP liquidity pool, 25% operations, 25% treasury, and 10% sub-token LP — all verifiable on-chain.",
      zh: "募集资金按比例分配至 TLP 流动池（40%）、运营资金（25%）、国库储备（25%）及子TOKEN LP（10%），全程链上透明可查。",
      "zh-TW": "募集資金按比例分配至 TLP 流動池（40%）、營運資金（25%）、國庫儲備（25%）及子TOKEN LP（10%），全程鏈上透明可查。",
      ja: "資金配分：TLP 流動性プール 40%、運営 25%、トレジャリー 25%、サブトークン LP 10%。すべてオンチェーンで検証可能。",
      ko: "자금 배분: TLP 유동성 풀 40%, 운영 25%, 국고 25%, 서브토큰 LP 10% — 모두 온체인에서 검증 가능합니다.",
      th: "การจัดสรร: TLP liquidity pool 40%, ปฏิบัติการ 25%, คลัง 25%, sub-token LP 10% ตรวจสอบได้บนเชน",
      vi: "Phân bổ: 40% vào TLP liquidity pool, 25% vận hành, 25% kho bạc, 10% sub-token LP — đều xác minh on-chain.",
    },
  },
  {
    q: {
      en: "How is daily USDT income settled?",
      zh: "每日 USDT 收益如何结算？",
      "zh-TW": "每日 USDT 收益如何結算？",
      ja: "毎日の USDT 収益はどのように決済されますか？",
      ko: "일일 USDT 수익은 어떻게 정산되나요?",
      th: "รายได้ USDT รายวันถูกชำระอย่างไร?",
      vi: "Thu nhập USDT hàng ngày được thanh toán thế nào?",
    },
    a: {
      en: "Settled automatically to your bound address every day at UTC 00:00 based on your node tier — no manual claim required.",
      zh: "每日 UTC 00:00 按持仓节点等级自动结算至绑定地址，无需手动领取。",
      "zh-TW": "每日 UTC 00:00 依持有節點等級自動結算至綁定地址，無需手動領取。",
      ja: "毎日 UTC 00:00 にノード等級に応じてバインド済みアドレスへ自動決済されます — 手動請求は不要。",
      ko: "매일 UTC 00:00 노드 등급에 따라 바인딩된 주소로 자동 정산됩니다 — 수동 청구 불필요.",
      th: "ชำระอัตโนมัติเข้าที่อยู่ที่ผูกไว้ทุกวันเวลา UTC 00:00 ตามระดับโหนด — ไม่ต้องเคลม",
      vi: "Tự động thanh toán mỗi ngày 00:00 UTC vào địa chỉ đã liên kết theo cấp node — không cần claim thủ công.",
    },
  },
  {
    q: {
      en: "When are sub-token airdrops distributed?",
      zh: "子TOKEN空投何时发放？",
      "zh-TW": "子TOKEN空投何時發放？",
      ja: "サブトークン エアドロップはいつ配布されますか？",
      ko: "서브토큰 에어드롭은 언제 배포되나요?",
      th: "Sub-token airdrop จะแจกจ่ายเมื่อใด?",
      vi: "Khi nào sub-token airdrop được phát?",
    },
    a: {
      en: "First airdrop within 30 days of mainnet launch, with quarterly supplements. Airdrop rights accrue in real time while you hold the node.",
      zh: "主网上线后 30 天内完成首次空投，后续按季度补发。持有节点期间的空投权益实时累计。",
      "zh-TW": "主網上線後 30 天內完成首次空投，後續按季度補發。持有節點期間的空投權益即時累計。",
      ja: "メインネット稼働後 30 日以内に初回エアドロップ、以降は四半期ごとに追加配布。ノード保有中はリアルタイムで権利が積み上がります。",
      ko: "메인넷 가동 후 30일 이내 첫 에어드롭, 이후 분기별로 보충. 노드 보유 기간 동안 권리가 실시간으로 누적됩니다.",
      th: "Airdrop รอบแรกภายใน 30 วันหลังเปิดเมนเน็ต และทยอยเพิ่มทุกไตรมาส สิทธิ์จะสะสมทันทีระหว่างถือโหนด",
      vi: "Đợt airdrop đầu trong 30 ngày sau khi mainnet ra mắt, bổ sung hàng quý. Quyền lợi tích lũy theo thời gian thực khi giữ node.",
    },
  },
  {
    q: {
      en: "Can node seats be transferred?",
      zh: "节点席位是否可以转让？",
      "zh-TW": "節點席位是否可以轉讓？",
      ja: "ノード席は譲渡可能ですか？",
      ko: "노드 좌석은 양도 가능한가요?",
      th: "ที่นั่งโหนดสามารถโอนได้ไหม?",
      vi: "Ghế node có thể chuyển nhượng được không?",
    },
    a: {
      en: "Node seats are non-transferable during the current phase and locked until mainnet activation. Secondary market transfers will open after governance upgrades.",
      zh: "当前阶段节点席位不可转让，合约锁定至主网激活。后续治理升级后将开放二级市场流通。",
      "zh-TW": "當前階段節點席位不可轉讓，合約鎖定至主網啟動。後續治理升級後將開放二級市場流通。",
      ja: "現フェーズでは譲渡不可、メインネット稼働まで契約でロック。ガバナンスのアップグレード後にセカンダリ流通を開放予定。",
      ko: "현재 단계에서는 양도 불가하며 메인넷 가동까지 컨트랙트에 잠겨 있습니다. 거버넌스 업그레이드 후 2차 시장 유통이 열립니다.",
      th: "ในเฟสปัจจุบันยังโอนไม่ได้ ล็อกในสัญญาจนกว่าเมนเน็ตจะใช้งาน รอนโยบายธรรมาภิบาลก่อนเปิดตลาดรอง",
      vi: "Trong giai đoạn này không thể chuyển nhượng, hợp đồng khóa cho tới khi mainnet kích hoạt. Thị trường thứ cấp mở sau khi nâng cấp governance.",
    },
  },
  {
    q: {
      en: "How is the 170.82% APY calculated?",
      zh: "年化 170.82% 如何计算？",
      "zh-TW": "年化 170.82% 如何計算？",
      ja: "年率 170.82% はどのように算出されますか？",
      ko: "연 170.82% 수익률은 어떻게 계산되나요?",
      th: "APY 170.82% คำนวณอย่างไร?",
      vi: "APY 170.82% được tính thế nào?",
    },
    a: {
      en: "Based on Super-tier node ($10,000): 180-day USDT income of $8,424 annualized ≈ 170.82%. Excludes token airdrops and MOTHER TOKEN appreciation.",
      zh: "以超级节点（$10,000投入）为基准：仅计入180天USDT收益$8,424，折算年化≈170.82%。不含TOKEN空投及母TOKEN市值增长部分。",
      "zh-TW": "以超級節點（$10,000 投入）為基準：僅計入 180 天 USDT 收益 $8,424，折算年化 ≈ 170.82%。不含 TOKEN 空投及母 TOKEN 市值增長部分。",
      ja: "超級ノード ($10,000) 基準：180 日 USDT 収益 $8,424 を年率換算 ≈ 170.82%。トークン エアドロップやマザートークンの値上がりは含みません。",
      ko: "수퍼 노드($10,000) 기준: 180일 USDT 수익 $8,424를 연환산 ≈ 170.82%. 토큰 에어드롭과 마더 토큰 가치 상승은 제외.",
      th: "อ้างอิงโหนด Super ($10,000): รายได้ USDT 180 วัน $8,424 คำนวณเป็นรายปี ≈ 170.82% ไม่รวมเอกสาร airdrop และมูลค่ามาเธอร์โทเค็น",
      vi: "Dựa trên node Super ($10,000): thu nhập USDT 180 ngày $8,424 quy năm ≈ 170.82%. Không gồm airdrop token và tăng giá Mother Token.",
    },
  },
];

interface JoinStep { title: LocaleMap; desc: LocaleMap }
const STEPS: JoinStep[] = [
  {
    title: {
      en: "Connect Wallet", zh: "连接钱包", "zh-TW": "連接錢包",
      ja: "ウォレット接続", ko: "지갑 연결", th: "เชื่อมต่อกระเป๋า", vi: "Kết nối ví",
    },
    desc: {
      en: "Connect a Web3 wallet (MetaMask, TokenPocket, Trust, OKX…)",
      zh: "连接 Web3 钱包（MetaMask、TokenPocket、Trust、OKX 等）",
      "zh-TW": "連接 Web3 錢包（MetaMask、TokenPocket、Trust、OKX 等）",
      ja: "Web3 ウォレットを接続（MetaMask、TokenPocket、Trust、OKX など）",
      ko: "Web3 지갑 연결 (MetaMask, TokenPocket, Trust, OKX 등)",
      th: "เชื่อมต่อกระเป๋า Web3 (MetaMask, TokenPocket, Trust, OKX ฯลฯ)",
      vi: "Kết nối ví Web3 (MetaMask, TokenPocket, Trust, OKX…)",
    },
  },
  {
    title: {
      en: "Bind Referrer", zh: "绑定推荐关系", "zh-TW": "綁定推薦關係",
      ja: "リファラー登録", ko: "리퍼러 바인딩", th: "ผูกผู้แนะนำ", vi: "Liên kết người giới thiệu",
    },
    desc: {
      en: "Submit the on-chain bind-referrer transaction once per wallet",
      zh: "每个钱包提交一次链上绑定推荐人交易",
      "zh-TW": "每個錢包提交一次鏈上綁定推薦人交易",
      ja: "各ウォレットで一度だけオンチェーンのリファラー登録トランザクションを送信",
      ko: "지갑별로 한 번씩 온체인 리퍼러 바인딩 트랜잭션 전송",
      th: "ส่งธุรกรรมผูกผู้แนะนำบนเชนหนึ่งครั้งต่อกระเป๋า",
      vi: "Gửi giao dịch liên kết người giới thiệu on-chain mỗi ví một lần",
    },
  },
  {
    title: {
      en: "Choose Node", zh: "选择节点", "zh-TW": "選擇節點",
      ja: "ノード選択", ko: "노드 선택", th: "เลือกโหนด", vi: "Chọn node",
    },
    desc: {
      en: "Pick the tier that matches your stake — L1 to L5",
      zh: "按投资规模选择节点等级（L1–L5）",
      "zh-TW": "依投資規模選擇節點等級（L1–L5）",
      ja: "投資規模に合わせてノード等級を選択（L1–L5）",
      ko: "투자 규모에 맞는 노드 등급 선택 (L1–L5)",
      th: "เลือกระดับโหนดตามขนาดการลงทุน (L1–L5)",
      vi: "Chọn cấp node phù hợp khoản đầu tư — L1 đến L5",
    },
  },
  {
    title: {
      en: "Pay & Activate", zh: "支付激活", "zh-TW": "支付啟動",
      ja: "支払いと有効化", ko: "결제 및 활성화", th: "ชำระและเปิดใช้งาน", vi: "Thanh toán & kích hoạt",
    },
    desc: {
      en: "Approve USDT and pay; the node activates on contract confirm",
      zh: "授权并支付 USDT，合约确认后节点即时激活",
      "zh-TW": "授權並支付 USDT，合約確認後節點即時啟動",
      ja: "USDT を承認して支払うと、契約確定後にノードが即時有効化",
      ko: "USDT 승인 후 결제하면 컨트랙트 확정 즉시 노드 활성화",
      th: "อนุมัติและชำระ USDT โหนดจะเปิดใช้งานทันทีเมื่อสัญญายืนยัน",
      vi: "Approve và thanh toán USDT; node được kích hoạt ngay khi hợp đồng xác nhận",
    },
  },
];

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

// ─── Node card skeleton ────────────────────────────────────────────────────────
function NodeCardSkeleton() {
  return (
    <div className="relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-16 bg-white/10" />
          <Skeleton className="h-6 w-20 bg-white/10" />
        </div>
        <Skeleton className="h-5 w-10 rounded bg-white/10" />
      </div>
      <div className="space-y-2.5 flex-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between gap-1">
            <Skeleton className="h-3 w-20 bg-white/10" />
            <Skeleton className="h-3 w-16 bg-white/10" />
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="flex justify-between">
          <Skeleton className="h-2.5 w-24 bg-white/10" />
          <Skeleton className="h-2.5 w-8 bg-white/10" />
        </div>
        <Skeleton className="h-1.5 w-full bg-white/10 rounded-full" />
        <Skeleton className="h-2.5 w-20 bg-white/10 ml-auto" />
      </div>
      <Skeleton className="mt-4 h-9 w-full rounded-md bg-white/10" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Recruit() {
  const showZh = useShowZh();
  const tt = useT();
  const account = useActiveAccount();
  const { isDemoMode, demoAddress, demoNodeId, exitDemo } = useDemoStore();
  const [, navigate] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // REST overview still supplies the marketing-style metadata (tier English
  // name, daily USDT projection, airdrop-per-seat, etc.) that isn't stored
  // on-chain — these are project constants, fine to keep off-chain.
  const { data: overview, isLoading } = useGetRuneOverview();

  // On-chain live reads: NodePresell.getNodeConfigs returns the five tiers'
  // real-time `curNum` / `maxLimit`, and Community.referrerOf tells us
  // whether the connected wallet is already bound. We overlay both on top
  // of the REST rows so the UI reflects the chain within 15 s of any tx.
  const { data: onChainConfigs } = useNodeConfigs();
  const onChainArray = (onChainConfigs as OnChainNodeConfig[] | undefined) ?? [];
  const onChainByNodeId = new Map<number, OnChainNodeConfig>(
    onChainArray.map((c) => [Number(c.nodeId), c]),
  );

  const { isBound: chainIsBound } = useReferrerOf(account?.address);
  const { hasPurchased: chainHasPurchased } = useUserPurchase(account?.address);

  // In demo mode, treat the selected address as already bound + purchased.
  const isBound = isDemoMode ? true : chainIsBound;
  const hasPurchased = isDemoMode ? true : chainHasPurchased;

  const nodes = overview?.nodes ?? [];

  return (
    <div className="container mx-auto px-4 py-6 sm:py-10 space-y-10 sm:space-y-14 max-w-6xl">

      {/* ── Demo banner ── */}
      {isDemoMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm text-cyan-300">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FlaskConical className="h-4 w-4 shrink-0" />
            <span className="font-medium truncate">{tt({ zh: "教学模式", "zh-TW": "教學模式", en: "Tutorial Mode", ja: "チュートリアルモード", ko: "튜토리얼 모드", th: "โหมดสอนใช้งาน", vi: "Chế độ hướng dẫn" })}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 px-3 py-1 text-xs font-medium hover:bg-cyan-500/20 transition-colors"
            >
              {tt({ zh: "进入 Dashboard →", "zh-TW": "進入 Dashboard →", en: "Open Dashboard →", ja: "ダッシュボードへ →", ko: "대시보드로 →", th: "เปิด Dashboard →", vi: "Mở Dashboard →" })}
            </button>
            <button
              type="button"
              onClick={() => { exitDemo(); navigate("/recruit"); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 px-2 py-1 text-xs font-medium hover:bg-cyan-500/20 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-b from-zinc-900 to-black backdrop-blur-md px-5 py-8 sm:px-8 sm:py-10 md:px-12 md:py-14 shadow-[0_0_80px_rgba(251,191,36,0.18),0_8px_48px_rgba(0,0,0,0.7)] text-center"
      >
        {/* Animated background orbs — opacity-only so blur is cached on GPU */}
        <motion.div
          animate={{ opacity: [0.28, 0.42, 0.28] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{ willChange: "opacity" }}
          className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/30 rounded-full blur-[110px] pointer-events-none"
        />
        <motion.div
          animate={{ opacity: [0.18, 0.30, 0.18] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          style={{ willChange: "opacity" }}
          className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-500/22 rounded-full blur-[100px] pointer-events-none"
        />
        <motion.div
          animate={{ opacity: [0.12, 0.22, 0.12] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          style={{ willChange: "opacity" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-purple-600/15 rounded-full blur-[90px] pointer-events-none"
        />

        {/* Corner brackets */}
        <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-amber-400/60 rounded-tl pointer-events-none" />
        <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-amber-400/60 rounded-tr pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-amber-400/60 rounded-bl pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-amber-400/60 rounded-br pointer-events-none" />

        <div className="relative z-10">
          <div className="relative inline-flex items-center gap-2 rounded-full border border-amber-400/60 bg-amber-950/60 px-4 py-1.5 mb-6">
            {/* Glow layer — only opacity animates, shadow is static (GPU-composited) */}
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ willChange: "opacity" }}
              className="absolute inset-0 rounded-full shadow-[0_0_20px_4px_rgba(251,191,36,0.5)] pointer-events-none"
            />
            <Zap className="h-3.5 w-3.5 text-amber-400 relative z-10" />
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-300 relative z-10 whitespace-nowrap">
              Node Recruitment · Open Now
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-3">
            <span className="bg-gradient-to-r from-white via-amber-100 to-amber-300 bg-clip-text text-transparent">
              {tt({ zh: "符·节点权柄重铸", "zh-TW": "符·節點權柄重鑄", en: "Node Tier Reforge", ja: "符・ノード権限再構築", ko: "符・노드 권한 재구축", th: "การหลอมระดับโหนด · 符", vi: "Đúc lại Cấp Node · 符" })}
            </span>
          </h1>
          <p className="text-[11px] sm:text-sm md:text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed mb-1.5 tracking-tight sm:tracking-normal">
            {tt({
              zh: "五级节点体系 · 双TOKEN通缩经济 · 机构级收益结构",
              "zh-TW": "五級節點體系 · 雙TOKEN通縮經濟 · 機構級收益結構",
              en: "5-Tier Nodes · Dual-Token Deflation · Institutional Returns",
              ja: "5 段階ノード · デュアルトークン デフレ · 機関級リターン",
              ko: "5단계 노드 · 듀얼토큰 디플레이션 · 기관급 수익",
              th: "5 ระดับโหนด · เศรษฐกิจดีเฟลชันแบบสองเหรียญ · ผลตอบแทนระดับสถาบัน",
              vi: "Hệ thống 5 cấp · Kinh tế giảm phát hai token · Lợi suất cấp tổ chức",
            })}
          </p>
          <p className="text-xs text-zinc-500 max-w-xl mx-auto hidden sm:block">
            RUNE Protocol Node Recruitment · Five-Tier System · Dual-Token Deflationary Economy
          </p>

          {/* Global metric strip */}
          <div className="mt-7 sm:mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-6 sm:pt-8 border-t border-amber-500/20">
            {[
              { label: { en: "Total Seats",   zh: "总席位",     "zh-TW": "總席位",     ja: "総席数",       ko: "총 좌석",   th: "ที่นั่งทั้งหมด",   vi: "Tổng số ghế" },     val: "2,420"  },
              { label: { en: "Node Tiers",    zh: "节点等级",   "zh-TW": "節點等級",   ja: "ノード等級",   ko: "노드 등급", th: "ระดับโหนด",       vi: "Cấp node"     },     val: "5"      },
              { label: { en: "Opening Price", zh: "开盘价",     "zh-TW": "開盤價",     ja: "開始価格",     ko: "오픈 가격", th: "ราคาเปิด",        vi: "Giá mở"        },     val: "$0.028" },
              { label: { en: "USDT APY",      zh: "年化收益率", "zh-TW": "年化收益率", ja: "年利",         ko: "연 수익률", th: "APY USDT",        vi: "APY USDT"     },     val: "170.82%", gold: true },
            ].map(({ label, val, gold }) => (
              <div key={label.en} className="space-y-0.5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-medium">{label.en}</div>
                <div className={`text-xl sm:text-3xl font-bold leading-none tabular-nums ${gold ? "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]" : "text-white"}`}>{val}</div>
                {showZh && <div className="text-[11px] text-zinc-500">{tt(label)}</div>}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* The onboarding orchestrator is mounted globally in App.tsx so the
          bind / purchase / dashboard-redirect flow fires from any page the
          moment the user connects via the header. No page-level mount here. */}

      {/* ── Node cards ── */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-cyan-500/40" />
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300 px-3 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
            {tt({ zh: "节点等级 · Node Tiers", "zh-TW": "節點等級 · Node Tiers", en: "Node Tiers", ja: "ノード等級", ko: "노드 등급", th: "ระดับโหนด · Node Tiers", vi: "Cấp node · Node Tiers" })}
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-cyan-500/40" />
        </div>

        <div className="relative">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background/80 to-transparent z-10 xl:hidden rounded-r-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {isLoading && nodes.length === 0
            ? Array.from({ length: 5 }).map((_, i) => <NodeCardSkeleton key={i} />)
            : TIER_ORDER.map((nodeId, i) => {
                // The card source-of-truth is the static tier table plus
                // NODE_META; REST overlays whatever extra metadata it has
                // for that level (so an out-of-date api-server doesn't
                // hide a tier). On-chain takes priority for live numbers.
                const meta   = NODE_META[nodeId];
                const stat   = TIER_STATIC[nodeId];
                const rest   = nodes.find((n) => LEVEL_TO_NODE_ID[n.level] === nodeId);
                const onChain = onChainByNodeId.get(nodeId);
                const level  = meta.level;

                const investment    = onChain ? Number(onChain.payAmount / 10n ** 18n) : meta.priceUsdt;
                const seats         = onChain ? Number(onChain.maxLimit) : (rest?.seats ?? stat.seats);
                // seatsRemaining must be authoritative — only the on-chain
                // `curNum` reflects real purchases. REST `seatsRemaining` is
                // a static placeholder in the overview table and would lie
                // about occupancy on a freshly-deployed contract. Default
                // to full-available while the chain read is in flight.
                const seatsRemaining = onChain
                  ? Number(onChain.maxLimit - onChain.curNum)
                  : seats;
                // directRate is basis points (PREVISION = 10000).
                const directRatePct = onChain ? Number(onChain.directRate) / 100 : null;
                const occupiedPct = seats > 0
                  ? Math.round(((seats - seatsRemaining) / seats) * 100)
                  : 0;
                const accent = NODE_ACCENT[level];
                const progressCls = NODE_PROGRESS_BAR[level];

                const privatePrice    = rest?.privatePrice    ?? stat.privatePrice;
                const dailyUsdt       = rest?.dailyUsdt       ?? stat.dailyUsdt;
                const airdropPerSeat  = rest?.airdropPerSeat  ?? stat.airdropPerSeat;

                return (
                  <motion.div
                    key={nodeId}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: i * 0.1 }}
                    whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                    className={`relative flex flex-col rounded-2xl border bg-gradient-to-b p-5 ${NODE_BG[level]} ${NODE_GLOW[level]} transition-shadow duration-300`}
                  >
                    {/* Top accent gradient strip */}
                    <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-gradient-to-r ${NODE_TOP_GLOW[level]}`} />

                    {/* Header */}
                    <div className="flex items-start justify-between mb-4 mt-1">
                      <div>
                        <div className={`text-[11px] font-mono uppercase tracking-[0.2em] mb-1 ${accent} drop-shadow-[0_0_6px_currentColor]`}>
                          {meta.nameEn}
                        </div>
                        <div className="text-xl font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">{tt({ zh: meta.nameCn, "zh-TW": meta.nameCn, ja: meta.nameCn, ko: meta.nameCn, en: meta.nameEn, th: meta.nameEn, vi: meta.nameEn })}</div>
                      </div>
                      <span className={`text-[11px] font-bold uppercase tracking-wider border rounded px-2 py-0.5 ${NODE_BADGE[level]}`}>
                        Lv.{i + 1}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex-1 space-y-4">

                      {/* Price — hero number */}
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500 font-medium mb-1.5">
                          {tt({ zh: "价格", "zh-TW": "價格", en: "Price", ja: "価格", ko: "가격", th: "ราคา", vi: "Giá" })}
                        </div>
                        <div
                          className="num text-[28px] leading-none"
                          style={{
                            color: `rgb(${meta.rgb})`,
                            filter: `drop-shadow(0 0 10px rgba(${meta.rgb}, 0.55))`,
                          }}
                        >
                          ${fmt(investment)}
                        </div>
                        <div className="text-[11px] text-zinc-600 mt-1 font-mono tracking-[0.15em] uppercase">USDT</div>
                      </div>

                      {/* Seats + Commission — 2-col */}
                      <div className="grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium mb-1">
                            {tt({ zh: "席位", "zh-TW": "席位", en: "Seats", ja: "席数", ko: "좌석", th: "ที่นั่ง", vi: "Ghế" })}
                          </div>
                          <div className="num text-lg leading-none text-zinc-100">
                            {showZh ? `${fmt(seats)} 席` : fmt(seats)}
                          </div>
                        </div>
                        {directRatePct !== null && (
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-medium mb-1">
                              {tt({ zh: "直推返佣", "zh-TW": "直推返佣", en: "Commission", ja: "直推報酬", ko: "직추천", th: "คอมตรง", vi: "Hoa hồng" })}
                            </div>
                            <div
                              className="num text-lg leading-none"
                              style={{ color: `rgb(${meta.rgb})`, filter: `drop-shadow(0 0 6px rgba(${meta.rgb}, 0.4))` }}
                            >
                              {directRatePct}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Seat progress */}
                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                        <span>{tt({ zh: "占用", "zh-TW": "占用", en: "Occupancy", ja: "充填", ko: "점유율", th: "การจอง", vi: "Lấp đầy" })}</span>
                        <span className={`${accent}`}>{occupiedPct}%</span>
                      </div>
                      <Progress value={occupiedPct} className={`h-1 bg-white/8 ${progressCls}`} />
                    </div>

                    {/* Buy CTA — three states tied to the on-chain user state:
                        1. disconnected → nudge toward the header Connect button
                        2. connected + already purchased → link to /dashboard
                           (contract limits each wallet to one purchase)
                        3. connected + not purchased → fire the re-open signal;
                           RuneOnboarding shows the Bind modal first if the
                           user still hasn't bound a referrer, then Purchase. */}
                    {!account ? (
                      <div className="mt-4 h-9 rounded-lg border border-dashed border-amber-700/30 bg-amber-950/10 flex items-center justify-center text-[11px] text-amber-200/70">
                        {tt({ zh: "连接钱包后可购买", "zh-TW": "連接錢包後可購買", en: "Connect wallet to purchase", ja: "ウォレット接続で購入可能", ko: "지갑을 연결하면 구매 가능", th: "เชื่อมกระเป๋าเพื่อซื้อ", vi: "Kết nối ví để mua" })}
                      </div>
                    ) : hasPurchased ? (
                      <Button
                        variant="outline"
                        asChild
                        className="mt-4 w-full h-9 text-sm font-medium border-emerald-700/40 hover:border-emerald-500/60 hover:bg-emerald-500/5 text-emerald-200"
                      >
                        <a href="/dashboard">{tt({ zh: "已购买 · 查看面板", "zh-TW": "已購買 · 查看面板", en: "Purchased · Open Dashboard", ja: "購入済 · ダッシュボードへ", ko: "구매 완료 · 대시보드 열기", th: "ซื้อแล้ว · เปิด Dashboard", vi: "Đã mua · Mở Dashboard" })}</a>
                      </Button>
                    ) : (
                      <Button
                        onClick={() => emitOpenPurchase(nodeId)}
                        className={`mt-4 w-full h-9 text-sm font-semibold ${NODE_BTN[level]}`}
                      >
                        {tt({ zh: "立即购买 · Buy Now", "zh-TW": "立即購買 · Buy Now", en: "Buy Now", ja: "今すぐ購入", ko: "지금 구매", th: "ซื้อเลย", vi: "Mua ngay" })}
                      </Button>
                    )}
                  </motion.div>
                );
              })
          }
        </div>
        </div>
      </section>

      {/* ── Genesis (创世) tier — L5, condition-triggered.
             Surfaced above "Why RUNE" so visitors see the aspirational
             L5 path before the generic value props. */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-500/30" />
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-amber-400 px-3 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
            {tt({ zh: "创世节点 · GENESIS · L6", "zh-TW": "創世節點 · GENESIS · L6", en: "Genesis · L6", ja: "創世ノード · GENESIS · L6", ko: "제네시스 · GENESIS · L6", th: "Genesis Node · L6", vi: "Genesis Node · L6" })}
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-500/30" />
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-br from-[#0f1a28] to-[#080f1a] p-5 sm:p-6 md:p-8 shadow-[0_2px_48px_rgba(251,191,36,0.08),inset_0_1px_0_rgba(251,191,36,0.06)]">
          {/* Subtle corner glow */}
          <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.07),transparent_60%)]" />
          <div className="relative space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full border border-amber-400/30 bg-amber-950/30 flex items-center justify-center">
                <Zap className="h-5 w-5 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-amber-400/60 mb-0.5">GENESIS · L6</div>
                <div className="text-base sm:text-xl md:text-2xl font-bold leading-snug num text-amber-100 break-words">
                  {tt({
                    zh: "创世节点 · 条件触发",
                    "zh-TW": "創世節點 · 條件觸發",
                    en: "Genesis Node · Condition-triggered",
                    ja: "創世ノード · 条件発動",
                    ko: "제네시스 노드 · 조건 발동",
                    th: "Genesis Node · ปลดล็อกตามเงื่อนไข",
                    vi: "Genesis Node · Kích hoạt theo điều kiện",
                  })}
                </div>
              </div>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {tt({
                zh: "创世节点非购买获得。任一等级节点持有者达成以下任意一个条件，即自动升级为创世节点，除保留已购节点的权重分红外，额外从核心激励池 10% 中按创世权重比例分配收益。",
                "zh-TW": "創世節點非購買取得。任一等級節點持有者達成以下任一條件，即自動升級為創世節點，除保留已購節點的權重分紅外，額外從核心激勵池 10% 中按創世權重比例分配收益。",
                en: "Genesis is not purchasable — any tier holder who meets any one of the conditions below is auto-upgraded. Genesis peers keep their base-tier dividends and additionally share 10% of the core incentive pool by weighted allocation.",
                ja: "創世ノードは購入できません。いずれかの条件を満たすと、保有ノードの分配を保持したまま自動昇格し、コアインセンティブプール 10% を創世重みで按分配分されます。",
                ko: "제네시스 노드는 구매할 수 없습니다. 아래 조건 중 하나라도 충족하면 자동 승급되며, 기존 등급 배당을 유지하면서 코어 인센티브 풀의 10%를 가중 배분받습니다.",
                th: "Genesis Node ไม่สามารถซื้อได้ — ผู้ถือโหนดระดับใดก็ตามที่ทำได้ตามเงื่อนไขต่อไปนี้จะอัปเกรดอัตโนมัติ และยังคงรับเงินปันผลตามระดับเดิมพร้อมกับส่วนแบ่ง 10% ของพูลแรงจูงใจหลัก",
                vi: "Genesis không mua được — bất kỳ chủ node nào đạt một trong các điều kiện dưới đây sẽ tự động được nâng cấp, vẫn giữ chia cổ tức cấp gốc và thêm 10% của pool khuyến khích chính theo trọng số.",
              })}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  label: { zh: "条件一 · 直推联创", "zh-TW": "條件一 · 直推聯創", en: "Condition 1 · Direct Founders", ja: "条件 1 · 直推 联创", ko: "조건 1 · 직추 联创", th: "เงื่อนไข 1 · แนะนำตรง 联创", vi: "Điều kiện 1 · Trực tiếp 联创" },
                  body:  { zh: "直推 ≥ 3 个联创节点（符主 · L5）", "zh-TW": "直推 ≥ 3 個聯創節點（符主 · L5）", en: "Refer ≥ 3 founder-tier (符主 · L5) nodes directly", ja: "直接紹介で 联创ノード（符主 · L5）≥ 3 名", ko: "직접 추천으로 联창 노드(符主 · L5) 3개 이상", th: "แนะนำตรง ≥ 3 联创 (符主 · L5)", vi: "Trực tiếp giới thiệu ≥ 3 联创 (符主 · L5)" },
                },
                {
                  label: { zh: "条件二 · 团队联创", "zh-TW": "條件二 · 團隊聯創", en: "Condition 2 · Team Founders", ja: "条件 2 · チーム 联创", ko: "조건 2 · 팀 联창", th: "เงื่อนไข 2 · ทีม 联创", vi: "Điều kiện 2 · Team 联창" },
                  body:  { zh: "团队矩阵累计 ≥ 5 个联创节点（符主 · L5）", "zh-TW": "團隊矩陣累計 ≥ 5 個聯創節點（符主 · L5）", en: "Accumulate ≥ 5 founder-tier (符主 · L5) nodes across the full team", ja: "チーム全体で 联创ノード（符主 · L5）≥ 5 名を保有", ko: "팀 전체에서 联창 노드(符主 · L5) 5개 이상 누적", th: "สะสม ≥ 5 联创 (符主 · L5) ในทีมรวม", vi: "Tích lũy ≥ 5 联창 (符主 · L5) trên toàn team" },
                },
                {
                  label: { zh: "条件三 · 团队超级", "zh-TW": "條件三 · 團隊超級", en: "Condition 3 · Team Supers", ja: "条件 3 · チーム 超级", ko: "조건 3 · 팀 超级", th: "เงื่อนไข 3 · ทีม 超级", vi: "Điều kiện 3 · Team 超级" },
                  body:  { zh: "团队矩阵累计 ≥ 30 个超级节点（符魂 · L4）", "zh-TW": "團隊矩陣累計 ≥ 30 個超級節點（符魂 · L4）", en: "Accumulate ≥ 30 super-tier (符魂 · L4) nodes across the full team", ja: "チーム全体で 超级ノード（符魂 · L4）≥ 30 名を保有", ko: "팀 전체에서 超级 노드(符魂 · L4) 30개 이상 누적", th: "สะสม ≥ 30 超级 (符魂 · L4) ในทีมรวม", vi: "Tích lũy ≥ 30 超级 (符魂 · L4) trên toàn team" },
                },
              ].map(({ label, body }) => (
                <div key={label.en} className="rounded-xl border border-white/[0.07] bg-[#0a1525]/60 p-4">
                  <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-amber-400/70 mb-2">
                    {tt(label)}
                  </div>
                  <p className="text-sm text-zinc-300 leading-snug">{tt(body)}</p>
                </div>
              ))}
            </div>
            {/* Reward strip */}
            <div className="rounded-xl border border-amber-400/20 bg-amber-950/20 p-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-amber-400/70 shrink-0">
                {tt({ zh: "创世专属奖励", "zh-TW": "創世專屬獎勵", en: "Genesis exclusive reward", ja: "創世専用リワード", ko: "제네시스 전용 보상", th: "รางวัลเฉพาะ Genesis", vi: "Phần thưởng Genesis" })}
              </span>
              <span className="num text-xl text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">
                {tt({ zh: "核心激励池 10%", "zh-TW": "核心激勵池 10%", en: "10% of core incentive pool", ja: "コア インセンティブ プール 10%", ko: "코어 인센티브 풀 10%", th: "10% ของพูลแรงจูงใจหลัก", vi: "10% pool khuyến khích chính" })}
              </span>
              <span className="text-xs text-zinc-500">
                {tt({ zh: "按创世节点权重占比加权分配", "zh-TW": "依創世節點權重佔比加權分配", en: "weighted by Genesis-peer node score", ja: "創世ノードの重み比率で按分", ko: "제네시스 노드 가중치 비율로 분배", th: "แบ่งตามน้ำหนักของโหนด Genesis", vi: "phân bổ theo trọng số node Genesis" })}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why RUNE ── */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-500/40" />
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300 px-3 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
            {tt({ zh: "为什么选择 RUNE · Why RUNE", "zh-TW": "為什麼選擇 RUNE · Why RUNE", en: "Why RUNE", ja: "なぜ RUNE か", ko: "왜 RUNE 인가", th: "ทำไมต้อง RUNE", vi: "Vì sao chọn RUNE" })}
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-500/40" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: TrendingUp,
              titleEn: "Dual-Token Deflation",
              title: { zh: "双TOKEN通缩", "zh-TW": "雙TOKEN通縮", en: "Dual-Token Deflation", ja: "デュアルトークン デフレ", ko: "듀얼토큰 디플레이션", th: "ดีเฟลชันสองโทเค็น", vi: "Giảm phát hai token" },
              desc:  {
                zh: "母TOKEN（RUNE）锚定 TLP 流动池，子TOKEN（SUB）持续燃烧销毁，双重通缩驱动长期价值增长。",
                "zh-TW": "母 TOKEN（RUNE）錨定 TLP 流動池，子 TOKEN（SUB）持續燃燒銷毀，雙重通縮驅動長期價值增長。",
                en: "MOTHER TOKEN (RUNE) anchored to TLP liquidity pool; SUB burned continuously — dual deflation drives long-term value.",
                ja: "マザートークン（RUNE）は TLP プールに連動、サブトークン（SUB）は継続バーン。二重デフレが長期価値を押し上げます。",
                ko: "마더 토큰(RUNE)은 TLP 풀에 앵커, 서브 토큰(SUB)은 지속 소각 — 이중 디플레이션이 장기 가치를 견인합니다.",
                th: "MOTHER TOKEN (RUNE) ผูกกับ TLP pool, SUB เผาต่อเนื่อง — ดีเฟลชันสองทางขับเคลื่อนมูลค่าระยะยาว",
                vi: "MOTHER TOKEN (RUNE) gắn TLP pool; SUB liên tục burn — giảm phát kép thúc đẩy giá trị dài hạn.",
              },
            },
            {
              icon: Zap,
              titleEn: "Six-Stage Price Roadmap",
              title: { zh: "六阶价格路线", "zh-TW": "六階價格路線", en: "Six-Stage Price Roadmap", ja: "6 段階の価格ロードマップ", ko: "6단계 가격 로드맵", th: "เส้นทางราคา 6 ขั้น", vi: "Lộ trình giá 6 giai đoạn" },
              desc:  {
                zh: "从私募价 $0.016 到开盘价 $0.028，再到 $0.5 长期目标，六阶定价路线清晰可追踪。",
                "zh-TW": "從私募價 $0.016 到開盤價 $0.028，再到 $0.5 長期目標，六階定價路線清晰可追蹤。",
                en: "From private price $0.016 to opening $0.028, targeting $0.5 long-term — six clearly defined pricing stages.",
                ja: "プライベート $0.016 → オープニング $0.028 → 長期目標 $0.5、6 段階の明確な価格ロードマップ。",
                ko: "프라이빗 $0.016 → 오픈 $0.028 → 장기 목표 $0.5, 6단계 명확한 가격 로드맵.",
                th: "จากราคาพรีเซล $0.016 ถึงราคาเปิด $0.028 และเป้าหมายระยะยาว $0.5 รวม 6 ขั้นชัดเจน",
                vi: "Từ giá private $0.016 đến giá mở $0.028, mục tiêu dài hạn $0.5 — 6 giai đoạn giá rõ ràng.",
              },
            },
            {
              icon: Shield,
              titleEn: "Ecosystem Incentives",
              title: { zh: "生态激励", "zh-TW": "生態激勵", en: "Ecosystem Incentives", ja: "エコシステム特典", ko: "생태계 인센티브", th: "สิทธิประโยชน์อีโคซิสเต็ม", vi: "Khuyến khích hệ sinh thái" },
              desc:  {
                zh: "节点持有者优先获得治理投票权、子TOKEN空投、新项目白名单及 OTC 渠道等多重生态权益。",
                "zh-TW": "節點持有者優先獲得治理投票權、子 TOKEN 空投、新專案白名單及 OTC 通路等多重生態權益。",
                en: "Node holders get priority governance rights, sub-token airdrops, whitelist access, and OTC channel benefits.",
                ja: "ノード保有者は優先ガバナンス、サブトークン エアドロップ、新案件ホワイトリスト、OTC チャネルなどの特典を享受。",
                ko: "노드 홀더는 우선 거버넌스, 서브토큰 에어드롭, 신규 프로젝트 화이트리스트, OTC 채널 등 다양한 혜택을 받습니다.",
                th: "ผู้ถือโหนดได้สิทธิ์โหวตธรรมาภิบาล, sub-token airdrop, whitelist โครงการใหม่ และช่อง OTC",
                vi: "Chủ node nhận quyền governance ưu tiên, airdrop sub-token, whitelist dự án mới và kênh OTC.",
              },
            },
          ].map(({ icon: Icon, title, titleEn, desc }) => (
            <motion.div
              key={titleEn}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#0c1624] to-[#08111e] p-6 space-y-3 shadow-[0_2px_24px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center gap-2.5">
                <Icon className="h-5 w-5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                <span className="font-bold text-base text-white">{tt(title)}</span>
              </div>
              {showZh && <p className="text-[11px] font-mono uppercase tracking-widest text-amber-400/50">{titleEn}</p>}
              <p className="text-sm text-zinc-400 leading-relaxed">{tt(desc)}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Join flow ── */}
      <section>
        <div className="flex items-center gap-2 mb-8">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-500/40" />
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300 px-3 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">
            {tt({ zh: "加入流程 · How to Join", "zh-TW": "加入流程 · How to Join", en: "How to Join", ja: "参加フロー", ko: "참여 절차", th: "วิธีเข้าร่วม", vi: "Cách tham gia" })}
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-500/40" />
        </div>

        {/* Mobile: vertical list with step number inline (left-aligned).
            Desktop: 4-column centered grid with the classic divider line. */}
        <div className="relative">
          <div className="hidden md:block absolute left-1/2 -translate-x-px top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-amber-500/30 to-transparent" />

          <div className="flex flex-col gap-4 md:grid md:grid-cols-4 md:gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12, duration: 0.4 }}
                className="flex flex-row items-start gap-4 rounded-xl border border-amber-500/20 bg-amber-950/10 p-4
                           md:flex-col md:items-center md:text-center md:rounded-none md:border-0 md:bg-transparent md:p-0 md:gap-3"
              >
                <motion.div
                  animate={{ boxShadow: ["0 0 16px rgba(251,191,36,0.25)", "0 0 32px rgba(251,191,36,0.50)", "0 0 16px rgba(251,191,36,0.25)"] }}
                  transition={{ duration: 2.5 + i * 0.3, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
                  className="relative z-10 flex items-center justify-center w-10 h-10 shrink-0 rounded-full border-2 border-amber-400/70 bg-amber-950/80 text-amber-300 font-bold text-sm"
                >
                  {i + 1}
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white text-sm mb-0.5">{tt(step.title)}</div>
                  {showZh && <div className="text-[11px] text-amber-400/80 uppercase tracking-wider mb-1.5">{step.title.en}</div>}
                  <p className="text-xs text-zinc-400 leading-relaxed">{tt(step.desc)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tutorial CTA ── */}
      {!isDemoMode && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-cyan-500/50 bg-cyan-950/30 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-[0_0_40px_rgba(34,211,238,0.12)]"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl border border-cyan-500/50 bg-cyan-950/60 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(34,211,238,0.3)]">
              <BookOpen className="h-4.5 w-4.5 text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-cyan-200 break-words">
                {tt({
                  zh: "初次接触？体验完整教学流程",
                  "zh-TW": "初次接觸？體驗完整教學流程",
                  en: "New here? Walk through the full tutorial",
                  ja: "初めての方へ — チュートリアルで全体の流れを体験",
                  ko: "처음이신가요? 전체 튜토리얼을 따라가 보세요",
                  th: "เพิ่งเริ่มใช้? ลองทำตามทูตอเรียลเต็มขั้นตอน",
                  vi: "Lần đầu? Trải nghiệm hướng dẫn đầy đủ",
                })}
              </p>
              <p className="text-xs text-muted-foreground/70 leading-snug mt-0.5 break-words">
                {tt({
                  zh: "模拟连接钱包 → 绑定推荐人 → 购买节点 → 查看 Dashboard，零成本感受完整流程",
                  "zh-TW": "模擬連接錢包 → 綁定推薦人 → 購買節點 → 查看 Dashboard，零成本體驗完整流程",
                  en: "Simulate connect wallet → bind referrer → purchase node → explore dashboard — zero cost",
                  ja: "ウォレット接続 → リファラー登録 → ノード購入 → ダッシュボード閲覧をすべて模擬体験 — 費用ゼロ",
                  ko: "지갑 연결 → 리퍼러 바인딩 → 노드 구매 → 대시보드 탐색까지 비용 없이 시뮬레이션",
                  th: "จำลองทุกขั้นตอน เชื่อมกระเป๋า → ผูกผู้แนะนำ → ซื้อโหนด → เปิด Dashboard โดยไม่มีค่าใช้จ่าย",
                  vi: "Mô phỏng kết nối ví → liên kết người giới thiệu → mua node → xem Dashboard — miễn phí",
                })}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/tutorial")}
            className="w-full sm:w-auto shrink-0 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/60 gap-2"
          >
            <BookOpen className="h-4 w-4" />
            {tt({ zh: "进入教学模式", "zh-TW": "進入教學模式", en: "Start Tutorial", ja: "チュートリアル開始", ko: "튜토리얼 시작", th: "เริ่มทูตอเรียล", vi: "Bắt đầu hướng dẫn" })}
          </Button>
        </motion.div>
      )}

      {/* ── FAQ ── */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-zinc-500/40" />
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-300 px-3">
            {tt({ zh: "常见问题 · FAQ", "zh-TW": "常見問題 · FAQ", en: "FAQ", ja: "よくある質問", ko: "자주 묻는 질문", th: "คำถามที่พบบ่อย", vi: "Câu hỏi thường gặp" })}
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-zinc-500/40" />
        </div>

        <div className="space-y-2 max-w-3xl mx-auto">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openFaq === i;
            return (
              <div
                key={i}
                className={`rounded-xl border overflow-hidden transition-all duration-200 ${isOpen ? "border-amber-500/40 bg-amber-950/20 shadow-[0_0_20px_rgba(251,191,36,0.08)]" : "border-zinc-700/40 bg-zinc-900/40"}`}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors"
                >
                  <span className={`text-sm font-medium ${isOpen ? "text-amber-200" : "text-zinc-200"}`}>{tt(item.q)}</span>
                  {isOpen
                    ? <ChevronUp className="h-4 w-4 text-amber-400 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />
                  }
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-1">
                        <p className="text-sm leading-relaxed text-zinc-400">
                          {tt(item.a)}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
