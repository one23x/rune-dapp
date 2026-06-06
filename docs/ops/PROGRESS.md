# Rune 项目进度看板

> **单一进度源**,Claude 维护。规则:
> - **详细记录**进下方「任务流水」(每步/每阶段都记)。
> - 每个里程碑完成时勾 `- [x]`,**Stop hook 自动把新完成项推到 Slack**(每阶段一条,不刷屏)。
> - Slack webhook 配在 `.claude/hooks/.slack-webhook`(当前为空占位,填入有效 URL 即生效)。

_最后更新:2026-05-30_

## 🔄 当前阶段
搭建协作基础设施(Slack 通知 / 配合规范 / 进度记录)。engine/workers 部署由你重开发中。

## ✅ 里程碑(勾选即推 Slack)
- [x] 2026-05-30 老服务器 sshd 根因定位+根治(acpid + suspend 拦截幽灵电源键)
- [x] 2026-05-30 env 凭证迁到美东(14 个文件 → `old-envs.tgz`)
- [x] 2026-05-30 数据库迁移 ai-engine-db → rune-prod-pg(2.4GB / 64 表,已验证一致)
- [x] 2026-05-30 训练数据 S3 跨区迁移(24.5MB → sagemaker-us-east-1)
- [x] 2026-05-30 代码 push:demo-rune(4028608)+ one-agents(48e7e27)→ one23x
- [x] 2026-05-30 SG 同步代码 + demo-rune hl.ts 3-way 合并(零冲突)
- [x] 2026-05-30 VPC peering SG↔US-east 确认 active(双向路由)
- [x] 2026-05-30 删除爱尔兰全栈(省 ~$190/月,留 RDS final snapshot)
- [ ] engine/workers 部署到美东(你重开发中)
- [x] 2026-05-30 协作基础设施搭建完成(Slack hook + 规范 + 文档)

## 📋 任务流水(详细,持续追加 — 新的在最上)
- 2026-06-06 admin-panel 新增「交易账户」页(/trading-accounts,已部署 rune-admin-mainnet):账户列表(连接钱包/托管EOA/HL网络/今日统计)→ 详情(每日统计真实vs修改双轨+行内编辑、当前持仓含手动行、全部交易记录、手动补订单/平仓/HL持仓)。配套 DB:trading_acct_daily 加 manual_* 覆盖列(rollup 只刷真实列,双轨并存,替代 is_manual 行锁),views 展示值=coalesce(manual,real)+附 real_* 列,v_wallet_open_positions 并入 admin 手动持仓,RLS admin_write(校验 admin_users)。admin 面板构建在 SG(~/projects/rune-admin-panel,需 PORT/BASE_PATH/VITE_SUPABASE_* env,outDir dist/public);本地副本已落后弃用。
- 2026-06-06 修复 /recruit 被覆盖事故:SG 侧从 d0c2833(无 recruit)二次部署盖掉本机版本 → 本机重部署恢复;随后统一代码:本地提交 9d60709,合并远端 PR #6 为 e893772(门控取远端 mode 版,PmTradeRecords 取远端,deposit-cap/HlDepositGuide 双保留),经 SG bundle 中转 push 回 GitHub main(本机 GitHub 账号 suspended 403,需解封/换 PAT),线上现为合并版。SG 另一会话的 unify/c44a60c-into-main 分支已无必要,待其放弃。
- 2026-06-06 HL 显示全面可手动调控 + 上线:新表 trading_hl_overrides(统计覆盖:净值/可提/浮盈/当日盈亏/跟单数,非null生效)+ trading_hl_manual_positions(持仓 add/replace/hide);前端 hl-display-overrides.ts useHlAccountAdjusted 包装 useHlAccount(3 个调用点全换),历史并入 trading_trade_records 手动行;新表被 Supabase 自动启 RLS 导致 anon 读空 → 加 public_read select policy(写仍拒);deploy:mainnet 已发(rune-lastest,wrangler 需 .env 的 CLOUDFLARE_ACCOUNT_ID/API_TOKEN 环境变量)。
- 2026-06-06 HL 标记价喂价上线:`scripts/trading-sync/hl-marks.mjs` 部署生产机 pm2(hl-marks,每 60s 拉 HL 主/测网 allMids → Supabase trading_mark_prices,venue=hl_mainnet/hl_testnet);rollup/持仓 view 改按网络取价;浮盈亏全真实化(测试网全账户浮亏 -$683,亏损监控抓到 4 个账户)。
- 2026-06-06 **修复 trading-sync 接错库**:生产引擎(one-agents-backend Docker)实际写 RDS `rune` 库,sync 一直读 `postgres` 库(旧引擎阶段数据,5/30 前 18 户)。已切源 `/postgres`→`/rune`(.env 备份 .env.bak-postgres-db;pm2 需 delete+start,restart --update-env 不生效因 RDS_URL 烤在进程 env);清理 Supabase 8 张镜像表旧行(trade_records 历史 1878 条 + is_manual 行保留);现同步 21 户/3026 HL 持仓。v_wallet_open_positions HL 改按币种聚合。前端新增 /copy-trading/stats(读新 views,替代 history 页)。
- 2026-06-06 Supabase 主网新增交易统计层(`scripts/trading-sync/stats-schema.sql`,additive 不动 sync):`trading_trade_records`(交易记录实体表,刷新只追加、手动补单永不被删改)、`trading_acct_daily`(每账户×venue×日快照,is_manual 保护)、`trading_mark_prices`(标记价,喂价后浮盈才非 0);views v_trade_records / v_wallet_daily_history / v_wallet_open_positions / v_wallet_today_closed / v_wallet_today_stats / v_loss_monitor_today;pg_cron trading-rollup-daily 每 10 分钟刷新。注意:HL 无 follower 成交流水(RDS 只有 leader 信号流 hl_copy_signals),HL 实现盈亏自 2026-06-06 起靠快照增量积累。
- 2026-05-30 搭建协作基础设施:.gitignore 堵 .claude 密钥、notify-slack.sh + Stop hook、PROGRESS/COLLABORATION/RUNBOOK/DECISIONS 文档。

## ⏳ 待办 / 风险
- **RDS final snapshot** `ai-engine-db-final-migrated`(eu-west-1)— 美东数据验证一段时间无误后可删,彻底省钱。
- **明文密钥 revoke** — `.claude/settings.local.json` 里有 3 个 GitHub PAT + Supabase 密码;迁移用的那个 PAT 也要 revoke。
- **demo-rune** 其余 41 个未提交文件 — 你正式 `git merge origin/master` 时处理(hl.ts 已合并,备份 `hl.ts.pre-merge.bak`)。
- **engine 不稳** — one-engine 在 SG 重启过 39 次,部署美东前查 `pm2 logs` 找根因。
