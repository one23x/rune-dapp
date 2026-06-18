# 运维 Runbook & 踩坑速查

爱尔兰→美东迁移期间积累的可复用运维知识。遇到类似情况直接查。

## 环境/工具
- **AWS CLI**:用 `~/.local/bin/aws`。Homebrew 的 `aws` 因 python@3.14 的 pyexpat 链接到系统 libexpat(缺符号)而崩。修法:官方 AWS CLI v2 pkg 装到 `~/.local`(`installer -pkg AWSCLIV2.pkg -target CurrentUserHomeDirectory`),`~/.zshrc` 加 `~/.local/bin` 到 PATH。
- **aws 脚本里 `--region` 必须直接写**,不要用变量 `R="--region eu-west-1"` 再 `$R` —— 沙箱执行时不做 word-split,`--region eu-west-1` 被当成一个未知选项报错。整个删除脚本可能因此静默失败(命令报错但后面无条件 echo ✓ 会误导)。

## 不稳定 EC2(sshd 反复挂起)
**症状**:实例 `running`、TCP 22 SYN 通,但 SSH 卡在 "banner exchange timeout";uptime 冻结不变;SSM agent ConnectionLost。
**根因**(本次):每 ~20s 一个幽灵 "Power key pressed short" ACPI 事件,被 **`acpid` 守护进程**拦截直接关机/挂起,**绕过** systemd-logind 的 `HandlePowerKey`。机器进 suspend → vCPU 暂停 → 全部无响应,但 EC2 层仍 running。
**排查**:`systemctl is-active acpid`;`journalctl -b | grep -i "power key\|suspend\|hibernat"`;看 uptime 是否冻结(suspend 的标志)。
**根治**:
```
systemctl stop acpid acpid.socket && systemctl mask acpid acpid.socket && pkill -9 acpid
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target \
  systemd-suspend.service systemd-hibernate.service systemd-hybrid-sleep.service
```
**临时操作手法**(机器还不稳时):`aws ec2 reboot-instances` 给干净窗口 → 每 3s 密集抢窗 ssh → 抢到立刻 `setsid <长任务> &`(脱离会话,suspend 前启动的出站任务能跑完)。reboot(不是 stop —— OS poweroff 会让实例 stopped)。

## 跨私网迁移 RDS(eu-west-1 → us-east-1,逻辑迁移进现有库)
两库都 `PubliclyAccessible=False`、各在自己 VPC。做法:
1. 临时给旧库开公网:`modify-db-instance --publicly-accessible --apply-immediately`。
2. **关键坑**:旧库子网路由表 `0.0.0.0/0` 指向 **NAT gateway**(只出不入),公网 IP 连不上。临时 `replace-route --gateway-id <igw>` 改成 IGW(原本无默认路由才能 create;有则 replace)。注意该路由表可能被多个子网/Lambda 共用,改了影响它们出站 → 用完 `replace-route` 回 NAT。
3. SG 放行源 IP 的 5432(美东 EC2 出口 IP)。
4. 美东 EC2 用 `docker run postgres:18 pg_dump <src> -Fc` → `pg_restore --no-owner --no-acl -d <dst>`(版本要匹配源库,用 docker 镜像最省事)。
5. 完事改回路由 NAT + 撤销 publicly-accessible + 撤销 SG 规则。

## 删除整个 VPC 栈(依赖顺序)
1. **应用层**(可并行):Lambda、EC2 terminate、RDS delete(**先关 deletion protection** `--no-deletion-protection`,再 `--final-db-snapshot-identifier` 留快照)、ElastiCache delete-replication-group、SQS、SNS、CloudWatch alarms、S3(版本桶要先删所有 version 再 `rb`)、EBS 快照。
2. 等 EC2/RDS/ElastiCache 删完 + 托管 ENI 自动释放(轮询,RDS ~10min)。
3. 2×NAT gateway(按小时收费,优先)→ 等 deleted。
4. 释放 EIP(NAT 删后才能 release)。
5. 子网(ENI 释放后才能删)。
6. IGW:detach 再 delete。
7. 路由表(留 main)、SG(**互引的先 `revoke-security-group-ingress/egress` 删光规则,再 delete**,否则循环依赖删不掉)。
8. VPC(自动带走 main 路由表 + default SG)。

## EBS 取出 stopped 机器上的文件(绕过坏掉的 sshd)
`stop-instances` → `create-snapshot <root-vol>` → 等 100% → `copy-snapshot` 跨区 → 等 100% → `create-volume`(目标 EC2 **同 AZ**)→ `attach-volume /dev/sdf` → Nitro 上是 `/dev/nvme1n1`,mount 最大分区(`nvme1n1p1`)→ 读文件 → 用完 umount/detach/delete-volume。git 操作挂载的 repo 加 `git config --global --add safe.directory <path>`。

## Slack 进度通知
`.claude/hooks/notify-slack.sh`(Stop hook)。webhook 填 `.claude/hooks/.slack-webhook`。它只推 PROGRESS.md 里新勾选的 `- [x]`,每阶段一条。

## RDS 双库陷阱(rune vs postgres)+ pm2 env 烤死
- `rune-prod-pg` 上有**两个库各带一套 trading schema**:`rune` = 生产引擎(one-agents-backend Docker `DATABASE_URL` 指它)实际读写;`postgres` = 旧引擎阶段遗留(数据停在 2026-05 月底)。**任何读 trading 数据的脚本必须连 `/rune`**。2026-06-06 trading-sync 曾因连 `/postgres` 导致 Supabase 数据滞后/缺新用户。
- **pm2 改 env 不要用 `restart --update-env`**:进程创建时的 env(含 .env 注入的)烤在 pm2 dump 里,sync.mjs 又是 process.env 优先,改 .env 后必须 `pm2 delete <name> && pm2 start ... && pm2 save` 才生效。
- 本机连 Supabase:直连 `db.<ref>.supabase.co:5432` 不通(IPv6-only),走 `aws-1-ap-northeast-2.pooler.supabase.com:5432`(用户名 `postgres.<ref>`)且加 `gssencmode=disable`。

## 跟单执行器拓扑 + 运维定时器(2026-06-09)
- **单一执行器铁律**:HL copy executor 只能在**一台**机器跑,否则重复下单。
  - worker `10.0.2.125`(ROLE=worker):`HL_COPY_EXECUTOR_ENABLED=true` + `COPYTRADE_MATCHER_ENABLED=true` = **唯一** HL 执行器 + PM matcher。
  - API 机 `10.0.1.159`(ROLE=all):`HL_COPY_EXECUTOR_ENABLED=false`(只留 API/treasury/gas)。PM consume 走 SQS FIFO 去重,两机跑也不双发;但 **HL 执行器无跨机去重**,故必须单机。改 env 后 `docker compose -f docker-compose.engine.yml up -d --no-deps --force-recreate backend` 生效。
- **worker systemd 定时器**(`/etc/systemd/system/*.timer`,脚本在 `~/`,跑 `ml-runner` 容器):
  - `ranker-eval.timer`(09:00 UTC):hl-copy-ranker 放行vs拦截事后核对 + leader-edge 成熟度 → `trading.ranker_eval_daily` / `leader_edge_readiness`。
  - `auto-subscribe-quality.timer`(每小时 :07):净值≥$15 的 mainnet 户**自动补订**所有 score≥65 非HFT leader(幂等,复用各户执行器档)。脚本 `~/auto-subscribe-quality.py`。
  - `copy-pnl-report.timer`(每4h :17):当日已实现盈亏 → `~/copy-pnl-report.log` + Supabase `trading_copy_pnl_daily`;有 `~/.slack-pnl-webhook` 则自动推 Slack(否则会话里用 MCP 转发)。
- **执行器菜单**:`hl_copy_subscriptions`/`copy_subscriptions`.`executor_id`(mirror/steady/aggressive/smart)。执行器**自带基础 sizing**(创建时带 executorId 即按档套 ratio/cap/日额/杠杆;不带=向后兼容用请求值)。**小户开单**:净值×ratio 撑不到 $10.5 的小账户,不被 balanceCap 集中度护栏挡,**净值≥~$15 即抬到最小单**。前端「选风格→选交易员→一键跟单」只传 `{leader, executorId}`。
- **部署/回滚**:push main → 两机 `git pull`(⚠️ **必须核对两机 `git log --oneline -1` 一致**;回滚用 `git checkout <commit>` 进 detached HEAD,`git checkout main` 可能落到旧 commit,务必显式核对)→ 容器内 apply 迁移 → build + up --no-deps --force-recreate。
- **教训(0 开仓排查)**:跟单显示「0 开仓」时,**先查 funded户(净值≥$15)× 活跃leader(近1-2h有开仓)的配对**——通常是**配置/资金错配**(有钱户订的 leader 在睡、活跃 leader 的户没钱 $0),**不是代码 bug、不是同步问题**。本次曾误判为重构回归、白回滚一轮。诊断顺序:① 信号在流? ② 执行器活着? ③ funded×活跃 配对存在? ④ 才查代码。解法=补订优质 leader。

## admin「待开户/找不到账号/连接钱包对不上/亏损/无数据」= 两个同步缺口(2026-06-10/11)
**全是显示问题,账户和钱都是好的。** 起因:运营在 admin 按节点钱包查某客户,显示成「待开户」、搜不到、或「亏了 68%」。逐层挖出两个根因:

1. **`hl_master_address` 从未从 RDS 同步到 Supabase**(`scripts/trading-sync/sync.mjs` 的 trading_users `cols` 列表漏了它,只同步 id/smart/engine/status/project/created/updated)。后果:
   - admin 搜索(`trading-accounts.tsx` ~L2035)和「待开户」视图 `v_admin_onboard_requests` 都按 `hl_master`(=节点/连接钱包)关联;Supabase 这列 null/stale → **按节点钱包搜不到、已开户的误显示成「待开户(无账户)」**。
   - **关键认知**:`hl_master_address` = 会员真实连接钱包(=买节点的钱包);`smart_wallet_address` = 工厂部署成功时**另建的 PM 智能钱包(≠节点钱包)**,失败则兜底=节点钱包;`engine_eoa_address` = 托管 HL 交易地址。**HL 数据全记在 engine_eoa 名下**,v_wallet_* 视图键=smart_wallet。三者常不相等(256 户里 217 户 smart≠master)。
   - **修**:① 一次性从 RDS 回填 Supabase `trading_users.hl_master_address`(238 户,改对 7 个,null 从一堆→0);② `sync.mjs` cols/src 加 `hl_master_address`+`hl_mode`(根治,新户不再漏);③ admin「连接钱包」列改显示 `hl_master`(非 smart_wallet)——数据查询走 `u.id`/`engine_eoa` 不受影响。

2. **HL 账户净值漏聚合 HIP-3 builder dex(`xyz`)**(`scripts/trading-sync/hl-account-state.mjs` 只查 `clearinghouseState` 主 perp)。后果:账户把保证金 `usdClassTransfer` 划进 builder dex 交易(xyz:XYZ100 等)后,主 perp 净值骤降 → **admin 余额/`trading_hl_account_state` 严重低估**(实测 0x3d35 显示 $0 实际 $840;0xE940 显示 $326 实际 $1074=主$326+dex$749,充$1005 实为 +7% 盈利却被当成亏 68%)。**24/254 主网户中招**。还会**误触发日亏熔断**(daily-supervisor 把它全部订阅 paused)。
   - **修**:`hl-account-state.mjs` 的 `fetchState` 改为查 `clearinghouseState`(主)+ `{dex:"xyz"}`(builder)并**相加** account_value/margin/ntl。已部署。持仓/成交同步本就跨 dex(`hl-positions.mjs` 主+builder、`hl-fills.mjs` userFillsByTime 含 `xyz:*`),**只有净值这一项漏**。
   - **诊断手法**:某 HL 户「钱不见了/像巨亏」→ 查 `engine_eoa` 的 `clearinghouseState` **主 + dex:"xyz" 两次**相加;`userNonFundingLedgerUpdates` 看 deposit/withdraw(send 到自己=划 dex,非转出);别只看主 perp。
   - 熔断器 `daily-supervisor.ts` 本身是 builder-dex-aware 的(合并 builder 持仓视图),修了净值源后不会再误停;误停的账户解除暂停后会立即恢复开单。

**速查映射**:节点钱包(rune_members/rune_purchases.user,BSC chain56)=hl_master=连接钱包;PM 智能钱包=smart_wallet(v_wallet_* 键);托管 HL 地址=engine_eoa(HL 链上数据键)。搜不到先确认按的是哪个 + Supabase 那几列是否同步对齐(全小写)。

## AgentChat 双 AI(与小符AI聊聊)+ 部署踩坑(2026-06-18)
浮窗聊天「与小符AI聊聊 / CHAT WITH RUNE AI」=**一个窗口、两套 AI、按意图自动路由**:链上/钱包/价格类 → **thirdweb Nebula**(读链/推理/准备交易),其余 → **OpenRouter**(策略脑,`anthropic/claude-haiku-4.5`)。前端 `src/app/components/strategy/agent-chat.tsx`,调 `/engine/v1/hl/agent/chat`(经 CF Pages Function 代理注入 `ONE_AGENTS_API_KEY` → `api.one-agents.com`)。后端在 **one-agents**(`src/routes/agent-chat.ts`),非本仓。

**后端部署法(one-agents,API 机 10.0.1.159 `synchost`)**:容器跑 `tsx src/server.ts` **直接从 `/app/src` 跑 TS,无 build/dist** → 部署=**容器内改文件 + `docker commit`**(不是 wrangler;`/app/src` 满地 `.predeploy-*`/`.bak.*` 是历史佐证)。流程:① `docker commit one-agents-backend one-agents-backend:pre-<x>-20260618`(回滚镜像)② 容器内改/`docker cp` 文件(留 `.predeploy-*`)③ `node node_modules/typescript/bin/tsc --noEmit`(只看你改的文件 0 新错;基线有 19 个无关存量错,vite/tsx 不 typecheck 照跑)④ `docker commit` 成新镜像 **retag `:latest`**(否则 `--force-recreate` 会回退丢)⑤ 改 `~/one-agents/backend/.env` 后必须 `docker compose -f docker-compose.engine.yml up -d --no-build --no-deps --force-recreate backend`(env_file 改动靠 recreate 生效;**`--no-build` 是铁律**,不加会从 Dockerfile 重建宿主磁盘 main 丢掉容器内改动)。flag:`AI_AGENT_CHAT_ENABLED`(总开关)/`AI_AGENT_THIRDWEB_ENABLED`(Nebula 分支)。回滚=`docker tag pre-<x>-20260618 latest`+recreate,或 flag 关。⚠️ API 机 `OPENROUTER_API` 本来没有(只在 **worker 机** + dev .env);Nebula 用 `THIRDWEB_SECRET_KEY`(API 机 .env 已有)。

**dapp 部署(rune-dapp)**:`pnpm build:mainnet` → `pnpm exec wrangler pages deploy dist/public --project-name rune-lastest --branch <分支> --commit-dirty=true`(CF creds 从 `prod-access.env` export `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`)。**分支名 = 子域**:`--branch main` → 生产(`rune-ai.io`/`rune.one-agents.com`/`rune-final.pages.dev`),`--branch feat-decision-log-preview` → `feat-decision-log-preview.rune-final.pages.dev`。项目 `rune-lastest` 无 git 集成,wrangler deploy 即部署。`rune-ai.io` 挂 **CF Access**(公网 curl 403,浏览器登录后正常);验证用 `rune-final.pages.dev`(无 Access)。

**踩坑1 — 部署空 dist 整站 404(=「找不到网页」)**:并发/残留的 `vite build` 会 `emptyOutDir` 清空 `dist/public`;若此时 deploy → wrangler 上传"0 files" → 部署整站 404(连 root)。**deploy 前必查** `ls dist/public/assets | wc -l`(应 ~240+)且 `dist/public/index.html` 存在;别让多个 build 并发。修复=`rm -rf dist` + 单次干净 build + 重部署。SPA 深链(`/app/*` 直接刷新/直链)靠 `dist/public/_redirects` 的 `/* /index.html 200`(+ `/api/*`、`/assets/*` 返真 404);`_routes.json` `include:["/engine/*"]`(只 /engine/* 跑 Function)。客户端导航不经服务器,所以"页内点能进、直链/刷新 404"=SPA fallback 没生效(多半是部署残缺)。

**踩坑2 — 意图路由太窄**:`agent-chat.ts` 的 `ONCHAIN_RE` 初版只匹配「转账」,自然口语「转 0.001 BNB 给 0x…」不命中 → 误进 OpenRouter 策略脑(回"超出范围,我不碰钱包")。已扩:`0x[40hex]`/`.eth`/`转\s*[\d.]`/转给/转到/发送/打款/链上/on-chain 等。改完容器内重 commit+recreate。**判断**:转账/链上请求若回"超出范围/我是策略代理"=被路由到了 OpenRouter,查 ONCHAIN_RE 是否覆盖该措辞。

**Nebula 契约**:`POST https://nebula-api.thirdweb.com/chat`,header `x-secret-key:<THIRDWEB_SECRET_KEY>`,body `{message,stream:false,session_id?,context:{chain_ids:[56,42161],wallet_address?}}`;resp `{message,actions,session_id,request_id}`;action=`{type:"sign_transaction",data:{chainId,to,value(hex wei),data}}`。前端 `<TxAction>` 用 `useActiveWallet().switchChain()` 切到 `data.chainId` 再 `sendTransaction`(用户钱包**非托管**签发,平台不碰私钥)。**Nebula 链上脑仅"准备交易",执行=用户签** → 用户必须先连钱包(未连→卡片提示"请先连接钱包")。
