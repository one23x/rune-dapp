import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { SwapWidget } from "thirdweb/react";
import { runeChain, runeChainKey } from "@/lib/thirdweb/chains";
import { getRuneAddresses } from "@/lib/thirdweb/addresses";
import { thirdwebClient } from "@/lib/thirdweb/client";
import { PageEnter } from "@app/components/page-enter";

/**
 * Map our i18n.language tag to thirdweb's `LocaleId` enum so the
 * connect-wallet sub-modal renders in the user's language. The swap
 * widget body itself isn't directly localizable in this thirdweb
 * version — page chrome (title + back button) carries the i18n.
 */
type ThirdwebLocale =
  | "en_US" | "zh_CN" | "ja_JP" | "ko_KR" | "es_ES" | "fr_FR"
  | "de_DE" | "ru_RU" | "pt_BR" | "vi_VN" | "tl_PH";

function pickThirdwebLocale(lang: string): ThirdwebLocale {
  const l = lang.toLowerCase();
  if (l.startsWith("zh")) return "zh_CN";
  if (l.startsWith("ja")) return "ja_JP";
  if (l.startsWith("ko")) return "ko_KR";
  if (l.startsWith("es")) return "es_ES";
  if (l.startsWith("fr")) return "fr_FR";
  if (l.startsWith("de")) return "de_DE";
  if (l.startsWith("ru")) return "ru_RU";
  if (l.startsWith("pt")) return "pt_BR";
  if (l.startsWith("vi")) return "vi_VN";
  return "en_US"; // ar / th / unknown → en
}

/**
 * Token swap page — thirdweb's `SwapWidget` (the dedicated swap UI).
 * Defaults to whichever chain `runeChain` resolves to at build time
 * (bsc_mainnet on main bundle, bsc_testnet on testnet bundle); the
 * widget handles connect state, quote, slippage and approval txs on
 * its own. We just wrap it in the page chrome + amber-tinted card.
 *
 * thirdweb branding intentionally hidden via `showThirdwebBranding=false`.
 * Connect-modal locale routed through to match the active i18n language.
 */
export default function ProfileSwapPage() {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const tdwLocale = pickThirdwebLocale(i18n.language);
  // Pre-fill both sides on BSC so the widget doesn't probe Ethereum (chain 1)
  // RPC for cross-chain quotes — that probe was 401-ing because the thirdweb
  // client ID isn't whitelisted for chain 1 in the dashboard.
  const { usdt } = getRuneAddresses(runeChainKey);
  const bscChainId = runeChain.id;

  return (
    <PageEnter>
      <div className="min-h-screen pb-24 lg:pb-8 lg:pt-4">
        <div className="px-4 pt-3 pb-4">
          <div className="flex items-center justify-center relative mb-4 lg:justify-start">
            <button
              onClick={() => navigate("/profile")}
              className="absolute left-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors lg:hidden"
              aria-label={t("common.back", "Back")}
            >
              <ArrowLeft className="h-5 w-5 text-white/80" />
            </button>
            <h1 className="text-[17px] font-bold tracking-wide text-foreground">
              {t("profile.swap", "Swap")}
            </h1>
          </div>
        </div>

        <div className="px-4 flex justify-center">
          <div
            className="w-full max-w-md rounded-3xl overflow-hidden surface-3d"
            style={{
              background: "linear-gradient(140deg, rgba(40,30,8,0.65), rgba(20,15,8,0.85) 70%, rgba(10,8,4,0.92))",
              border: "1px solid rgba(251,191,36,0.30)",
              boxShadow:
                "inset 0 1px 0 rgba(251,191,36,0.20), 0 12px 32px -10px rgba(251,191,36,0.20), 0 28px 60px -24px rgba(0,0,0,0.55)",
            }}
          >
            <SwapWidget
              client={thirdwebClient}
              theme="dark"
              showThirdwebBranding={false}
              prefill={{
                sellToken: { chainId: bscChainId },
                buyToken: { chainId: bscChainId, tokenAddress: usdt },
              }}
              connectOptions={{
                connectModal: { locale: tdwLocale },
              }}
            />
          </div>
        </div>
      </div>
    </PageEnter>
  );
}
