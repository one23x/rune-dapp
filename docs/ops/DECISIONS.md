# 决策记录(ADR-lite)

关键决策:选了什么、为什么、否决了什么。新的在最上。

## 2026-06-18 AgentChat 双 AI(与小符AI聊聊)

### D1 链上脑走「用户钱包非托管签发」,平台不代签
- **决定**:thirdweb Nebula 准备好的交易(actions)由**用户自己的钱包**在前端签名发送(`useActiveWallet().switchChain` + `sendTransaction`);平台 / 托管 engine 钱包**不代签**。
- **为什么**:转账 / swap / 建合约动的是用户的钱,代签 = 平台替用户动钱,风险与合规成本重;非托管让用户自主、平台不碰私钥。
- **否决**:托管 engine 钱包代执行(体验更顺、免弹窗)—— 风险/合规过高,暂不做。
- **代价/缓解**:用户必须先连钱包(未连 → 卡片提示"请先连接钱包");多链(BSC/Arbitrum)签发前 `useActiveWallet` 自动切链。

### D2 一个聊天窗口、两套 AI,按意图正则路由
- **决定**:单浮窗内 OpenRouter(策略脑)+ thirdweb Nebula(链上脑)共存;后端按消息意图(`ONCHAIN_RE`:地址 / 转账 / 价格 / 合约等)路由 —— 命中链上词 → Nebula,其余 → OpenRouter。
- **为什么**:策略对话与链上操作是两类能力,统一一个入口体验好;Nebula 擅长链上读写、OpenRouter 便宜稳地聊策略/行情。
- **否决**:① 两个独立入口(割裂)② 全交给 Nebula(策略对话不如通用 LLM)③ 让 LLM 自己判定路由(首版用正则更可控,边界措辞后续可升级)。
- **风险**:正则覆盖不全会误路由(已发生:"转 0.001 BNB 给…"漏判 → 已扩词;见 RUNBOOK)。

### D3 one-agents 后端用「容器内改 + docker commit」部署,不从 Dockerfile 重建
- **决定**:API 机后端 `tsx` 直跑 `/app/src`(无 build);部署 = 容器内改/`docker cp` 文件 + `docker commit` retag `:latest` + `compose up --no-build --no-deps --force-recreate backend`。
- **为什么**:容器代次比宿主磁盘 main 新(split-brain),从 Dockerfile 重建会回退丢改动;tsx 改文件即生效。
- **否决**:不带 `--no-build` 的 `compose up`(会从磁盘重建、丢容器内累积改动)。

## 2026-05-30 爱尔兰→美东迁移

### D1 迁移架构:SG=dev / US=prod / 爱尔兰退役
- **决定**:新加坡 EC2 做开发;美东做生产(one-engine 部署地);爱尔兰旧栈数据迁走后整体删除。
- **为什么**:旧栈在爱尔兰且那台 EC2 不稳;美东已有 Terraform 建好的 RDS/Redis/S3;SG↔US VPC peering 打通便于 dev→prod。

### D2 数据库迁移:临时公网 pg_dump 进现有 rune-prod-pg(否决 snapshot)
- **决定**:临时给旧 RDS 开公网 + 改子网路由,美东 docker postgres:18 直接 `pg_dump`→`pg_restore` 进**现有** rune-prod-pg。
- **否决**:RDS snapshot 跨区 copy —— 会得到**新实例**,不是导入现有库,还要再导一次。
- **结果**:2.4GB / 64 表(trading/demo/public)迁入,验证一致。版本都 18.3,零兼容问题。

### D3 缓存不迁
- **决定**:Valkey 缓存不迁,美东新 Redis 空启动。
- **为什么**:缓存是可重建的派生数据,应用重连即回填。

### D4 代码 push:token + EBS 取改动
- **决定**:用户给 PAT 推到 one23x;因老服务器挂起抢不到窗口,改用 **EBS 快照跨区→挂载美东→读出未提交改动→在美东 commit+push**。
- **为什么**:`onedeploy1010` 账号对 one23x 私有库 404 无权 → 必须换 token;老服务器 sshd 太不稳 → 绕过它从磁盘镜像取代码。

### D5 删除爱尔兰 + 留 RDS final snapshot
- **决定**:删光 eu-west-1 全栈(省 ~$190/月),RDS 删除时留 `ai-engine-db-final-migrated` final snapshot 作回滚保险。
- **为什么**:数据已验证迁到美东,但保留一份快照防万一,确认无误后再删。

### D6 demo-rune hl.ts 冲突:3-way 自动合并(保留两边)
- **决定**:GitHub 版(oid/fee/订单归并)与 SG 版(Phase C 去 pg 改 engine HTTP)改的是不同函数,`git merge-file` 零冲突自动合并,两边都保留。
- **为什么**:两边都是有价值改动,不该二选一。

## 待沉淀
- engine/workers 部署到美东的拓扑(ROLE=api 多副本 + ROLE=worker 单副本)— 部署时补 ADR。
