# MEMORY · 发布/DevOps 工程师（opsdev）

> 先查这里 + `docs/journey/LESSONS.md`（部署类）+ `docs/ops/RUNBOOK.md`。部署互盖是头号反复坑。

## 部署互盖（血泪，反复踩）
- **L010 双机/多会话部署互盖**：多出口对同一 CF/生产机部署，后部署者盖前者。→ dapp 部署前 `wrangler pages deployment list`；引擎生产代码备份 `prod-live`，生产机禁 `git pull main`；变更冻结窗口。**部署出口收敛到一个。**
- **L012 多会话同仓开发 = 互盖新形态**：同一天两会话各自重做 admin/dapp 并部署，互盖两次。修复=以 GitHub main 为基底功能合并 + cherry-pick。**动手前 `git fetch origin` 比对；部署前 deployment list 的 Source commit 必须在本地历史里；同模块开工前 PROGRESS 占座。**
- **L014 build 前必 `git fetch origin`**：基于落后本地 build 部署会把 origin 上的提交在产物里整体回退、线上回归。恢复=本地新分支基于 origin/main + cherry-pick + 重 build + FF push。

## 构建/部署陷阱
- **L004 退出码生命线**：`git am | tail` 吞退出码 + Dockerfile 不做类型检查 → 带冲突标记上生产 crash-loop。`set -e`、am 不接管道、build 前 grep `<<<<<<<`、独立 tsc。
- **L015 admin Pages 必带 functions**：漏 `functions/` → GET 落 SPA 假 200、POST 405。`cp -r functions dist/public/functions`，看「Uploading Functions bundle」。
- **嵌套 pnpm 被 corepack 切版本**冲突 → 拆两步跑；wrangler token 变量名可能是 `CLOUDFLARE_API_TOKEN_1`（需 export 成 `CLOUDFLARE_API_TOKEN`）。
- **回滚**：`git checkout <commit>` detached HEAD，**别用 `git checkout main`**（可能落旧 commit），显式核对两机一致。

## GitHub / 凭证
- **本机 GitHub 账号曾 suspended 403** → push 经 SG 中转（bundle / EBS 取改动）。临时 PAT 用完**主动提醒 revoke**（settings.local.json 有 3 个 PAT 是已知债）。
- 远程改动走 `ssh rune-sg`；共享机精确 `git add` 禁 `-A`（L003），改引擎用 worktree。

## 生产拓扑（部署相关）
- **单实例铁律**：worker `replicas:1`；HL executor 只能一台机器（跨机无去重）。改 env：`docker compose up -d --no-deps --force-recreate backend`；pm2 改 env 必 `delete+start+save`。
- 引擎备份分支 `prod-live`；两机 `git log -1` 必须一致。

## 链接
- CHARTER §5（部署纪律）/ RUNBOOK「跟单执行器拓扑」/ senior-engineer playbooks P2/P3（构建产物侧）
