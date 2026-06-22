# PLAYBOOKS · 资深工程师（可复用技能）

> 落代码 + 安全部署的标准打法。换仓照这套。

## P1 · 落一个 Phase 的代码
1. 读 `UPGRADE_PLAN.md` 当前 Phase + 现有代码（贴风格不另造）。
2. 远程 `ssh rune-sg ~/projects/<仓>`；改引擎用 `git worktree`(/tmp/oa-*) 隔离；开工前 PROGRESS 占座。
3. 新行为挂 flag(默认旧行为)；custodial 路径字节级不变；保留既有错误处理/logger/兜底。
4. 编译：`npm run lint` / `npx tsc --noEmit`；构建前 `grep '<<<<<<<'`。
5. 交接说明：改了哪些文件/为何/风险点/留给 red-teamer 审的点/留给 qa 验的命令端点。**不自称已验证。**

## P2 · 安全部署（前端 CF Pages）
1. **build 前 `git fetch origin && git log HEAD..origin/main`**——落后先合并再 build（L014）。
2. **admin 必 `cp -r functions dist/public/functions`**，看「Uploading Functions bundle」（L015）。
3. 部署前 `wrangler pages deployment list`，Source commit 必须在本地历史里（L010）。
4. 验证别只看 GET 200（可能 SPA 假象），看 JSON / POST 非 405。

## P3 · 安全部署（引擎 Docker）
两机 `git log -1` 必须一致；生产机禁 `git pull main`，备份 `prod-live`；`docker compose -f docker-compose.engine.yml up -d --no-deps --force-recreate backend`；`git am` 不接管道（吞退出码）。

## P4 · 接第三方/新协议（先实测）
- thirdweb 跨链支付：目标 token 先注册进 Universal Bridge（L016）。
- 引擎 AA 部署：用专用 `account-factory/create-account`；无 paymaster 先从 treasury faucet 补 POL（L017）。
- HIP-3：asset=100000+dexIdx×10000+i；带 dex 参数；下单前 sendAsset 划 USDC（L006）。

## P5 · git 安全（共享机）
精确 `git add <files>` 禁 `-A`（L003）；恢复落后部署：本地新分支基于 origin/main + `cherry-pick` 自己提交 + 重 build + FF push（L014）。

## 验证清单
flag 默认旧行为 / custodial 字节级不变 / tsc 0 错 / 兜底完好 / build 前 fetch / 交接说明列全 / 仅用户要求时 push。
