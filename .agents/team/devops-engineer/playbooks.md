# PLAYBOOKS · 发布/DevOps 工程师（可复用技能）

> 发布管线的标准打法。换主/换项目照这套。核心：**把"必须做对的事"变成不可跳过的门。**

## P1 · CF Pages 项目部署（preview + prod）
1. **build 前 `git fetch origin && git log HEAD..origin/main --oneline`** —— 落后先合并再 build（L014）。
2. 构建：`pnpm build`（嵌套 pnpm 被 corepack 切版本时拆两步跑）；`tsc --noEmit` 0 错；grep `<<<<<<<`。
3. **admin 必 `cp -r functions dist/public/functions`**，日志要见「Uploading Functions bundle」（L015）。
4. **部署前 `wrangler pages deployment list`**，确认 Source commit 在本地历史里、不在盖别人（L010）。
5. 部署（wrangler 需 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`，注意 .env 里变量名可能是 `CLOUDFLARE_API_TOKEN_1`）。
6. 验证：返回 JSON 而非 SPA 假 200、POST 非 405、`/version.json` no-store（iOS）。

## P2 · 引擎 Docker 生产部署
1. 两机 `git log --oneline -1` **必须一致**；生产机**禁 `git pull main`**，代码从 `prod-live` 取。
2. `git am` 不接管道（吞退出码）；改引擎用 worktree 隔离（L003）。
3. `docker compose -f docker-compose.engine.yml up -d --no-deps --force-recreate backend`。
4. **回滚**：`git checkout <commit>` 进 detached HEAD（**别用 `git checkout main`** 可能落旧 commit）；务必显式核对。
5. **单实例铁律**：Worker 角色 `replicas:1`（HL executor 跨机无去重）。

## P3 · GitHub Actions 管线（把纪律固化）
- **preview（PR 触发）**：checkout → `pnpm i` → `tsc --noEmit` → grep 冲突标记 → `next-on-pages` edge 检查 → CF 预览部署 → 评论预览 URL。
- **prod（合并 main）**：构建 → 制品 → **manual approval 门** → 部署 → 通知 Slack `ops-deployments`。
- 门：fetch 核对落后、tsc、防冲突标记、admin 带 functions——CI 里强制，过不了不合并。

## P4 · PR / 分支纪律
- main 分支保护：需 PR + CI 绿（+ 必要时 review）。
- 引擎生产代码备份 `prod-live` 分支；变更冻结窗口收敛部署出口。
- 提交结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`；**仅用户要求时**推/合并/部署。
- 用完的临时 PAT 主动提醒 revoke（本机 GitHub 账号曾 suspended 403 → 经 SG 中转推送）。

## P5 · 防多会话互盖（L012）
同模块开工前在 PROGRESS 流水占座声明；部署前查"最近谁部过"；恢复互盖：本地新分支基于 origin/main + `cherry-pick` 自己提交 + 重 build + FF push。

## 验证清单
不落后 origin / deployment list 不盖人 / admin 带 functions / tsc 0 错无冲突 / 有回滚点 / 单实例 / 生产经用户确认 / 发布记录落 PROGRESS+Slack。
