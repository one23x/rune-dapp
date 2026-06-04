import { AuthCodeManager } from "@/components/rune/auth-code-manager";

/**
 * Admin · 授权码管理 —— 生成/查看节点授权码(含总充值额度 + 兑换后绑定钱包)。
 * 对接后端 /admin/node/codes(X-Admin-Token 鉴权)。token 由 AuthCodeManager 内部输入,
 * 仅存 sessionStorage(`rune.adminToken`),刷新关闭即清,不落盘。与 /admin/funds 同一鉴权口径。
 */
export default function AdminCodes() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <AuthCodeManager />
    </div>
  );
}
