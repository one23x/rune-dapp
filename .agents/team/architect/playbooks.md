# PLAYBOOKS · 架构师（可复用技能）

> 出计划的标准打法。换 mission 照这套。

## P1 · 从战役到 UPGRADE_PLAN.md
1. 读 `docs/journey/ROADMAP.md` 当前阶段 + `missions/<战役>/` 剧本 + `VISION.md` 对齐主轴。
2. **先 Read 真实触点文件**（远程 `ssh rune-sg ~/projects/*`），别靠记忆。以代码实况为准修正文档假设（如 watermark-poll≠outbox）。
3. 判依赖：画 Phase 间谁堵谁（签名稳→agent 模式→规模化→AI）。
4. 拆到文件级：每步=具体文件改动 + API 变更 + feature flag(默认旧行为) + 回滚触发 + 验证门。
5. 自检（见 role.md 交接门）后交 senior-engineer。

## P2 · 设计跨仓共享数据流
- 守两库边界：信号/价格/AI 读引擎主库，客户数据落 project 库，经 watermark Position Sync。
- 归属必须有归属字段（`pack_key` 落库），不靠集合交集推断（L009）。
- 接"统一 API 子宇宙"（HIP-3 等）先实测三件事：怎么列资源、id 怎么算、余额/持仓在哪个视图（L006）。

## P3 · 务实评估（不重建够用的）
对每个"要不要升级"问：现状够用吗？只补缺失项。保留现有 CIDR/peering/两类机拓扑。重写=最后选项。

## 验证清单
每 Phase 有入/出标准+验证门 / 每步有 flag+回滚 / 无"重写一切" / 安全假设已标给 red-teamer / 以代码实况为准。
