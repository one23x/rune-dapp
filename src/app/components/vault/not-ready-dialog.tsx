import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Shared "feature not yet live" modal — used by vault stake / burn /
 * deposit buttons until the corresponding contracts ship. More obvious
 * than a toast, harder to miss. Pass `feature` to give the user the
 * specific name of what they tried to do.
 */
export function NotReadyDialog({
  open,
  onClose,
  feature,
}: {
  open: boolean;
  onClose: () => void;
  feature?: string;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="glass-panel-strong border-0 max-w-sm p-0 overflow-hidden">
        <div className="absolute -top-16 -right-12 w-44 h-44 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        <div className="relative p-6 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
            <Hourglass className="h-6 w-6 text-amber-300" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-white">
              {t("common.notReady.title", "暂未开放")}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/70 mt-2 leading-relaxed">
              {feature
                ? t("common.notReady.descWith", "{{feature}} 即将上线，敬请期待。", { feature })
                : t("common.notReady.desc", "该功能即将上线，敬请期待。")}
            </DialogDescription>
          </div>
          <Button
            onClick={onClose}
            className="w-full h-10 gold-button font-semibold"
          >
            {t("common.gotIt", "知道了")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
