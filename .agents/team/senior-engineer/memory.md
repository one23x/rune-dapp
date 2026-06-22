# MEMORY · 资深工程师 Senior Engineer

> 先查这里 + `docs/journey/LESSONS.md` + `docs/ops/RUNBOOK.md`。新坑修完追加。

## 部署/git（血泪，反复踩）
- **L004 退出码是生命线**：`git am | tail` 吞退出码 + Dockerfile 不做类型检查 → 带冲突标记上生产 crash-loop。`set -e`、am 不接管道、build 前 grep `<<<<<<<`、独立 tsc。
- **L014 build 前必 `git fetch origin`**：基于落后本地 build 部署会整体回退 origin 上的提交。恢复手法：本地新分支基于 origin/main + `cherry-pick` 自己提交 + 重 build + FF push。
- **L015 admin Pages 必带 functions**：`wrangler pages deploy dist/public` 漏 `functions/` → /api 代理没上线，GET 落 SPA 假 200、POST 405。必 `cp -r functions dist/public/functions`，看「Uploading Functions bundle」。
- **L003/L012 共享机互盖**：精确 add 指定文件；改引擎用 `git worktree`（/tmp/oa-*）；开工前 PROGRESS 占座；部署前 deployment list 的 Source commit 必须在本地历史里。
- **生产机禁 `git pull main`**：引擎生产代码备份 GitHub `prod-live`，两机 `git log --oneline -1` 必须一致；回滚用显式 commit 不靠 `git checkout main`。

## 集成 gotchas
- **L016 thirdweb 跨链支付**：目标 token 必须先注册进 Universal Bridge（pUSD 没注册 → 泛化 unknown error，clientId/域名都对也没用）。排查序：clientId→域名 allowlist→token 是否 bridge 注册。
- **L017 引擎 AA 部署**：未部署账户用专用 `account-factory/create-account`（自调用 sendTransaction 报 "Failed to find factory address"）；`gasless:true` 无 paymaster 时被忽略 → onboard 前从 treasury faucet 补 POL。
- **L006 HIP-3**：xyz 资产 asset=100000+dexIdx×10000+i；meta/clearinghouseState 带 dex 参数；下单前 sendAsset 划 USDC 进 dex。
- **pm2 改 env**：`restart --update-env` 不生效（env 烤在 dump）→ 必须 `pm2 delete && start && save`（RUNBOOK）。

## 前端
- **L001 iOS 拿不到新版**：构建注入 `__BUILD_ID__` + `/version.json`(no-store)，切前台比对 reload + `vite:preloadError` 兜底 + `safeReload` 带 cache-bust 导航。
- **纯 edge**：路由不引 `pg`/`fs`/`node:*`，非静态路由 `runtime="edge"`；会员展示链上 explorer 跳转恒 null 防穿帮。

## 链接
- 共享记忆 `.agents/memory/`（payembed-dialog-overflow、i18n-t-wrapper、canvas-update-payload…）
