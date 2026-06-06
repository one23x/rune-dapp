# 决策记录(ADR-lite)

关键决策:选了什么、为什么、否决了什么。新的在最上。

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
