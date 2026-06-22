# Missions · 战役剧本

> Mission = 通往 [VISION](../VISION.md) 北极星的一场具体战役。每个 mission 一个子目录，放它的剧本/计划/产出。
> 提醒：**mission 是切片，不是全部**。某次升级覆盖不到的主轴，不代表系统不需要它。

## 当前战役

### [tech-upgrade/](./tech-upgrade/) — Rune 技术升级（v3 Vault / agent 模式 / 规模化 / AI）
四大目标：① thirdweb v3 Vault 签名迁移 ② agent 模式 + builder fee + 20% HWM carry ③ 数千账户规模化（WS/批量/分片/多 IP）④ AI ranker 升级（12→30+ 维 / shadow / ONNX）。

- [agent-prompts.md](./tech-upgrade/agent-prompts.md) — 7 角色就绪提示词（原《Claude Code Agent Prompts》）。**注**：这些提示词已被 `team/<role>/role.md` 收编升级（焊上铁律/护栏/记忆），按岗位四件套执行即可，这里留作出处。
- [execution-runbook.md](./tech-upgrade/execution-runbook.md) — 分阶段执行预案（Phase 1–4 + 护栏 + 验证门 + 回滚触发）。**护栏已折进 [CHARTER §2](../CHARTER.md)**，进度落 `docs/journey/ROADMAP.md`。

映射：agent-prompts 的 7 角色 → 本框架岗位（architect / senior-engineer / red-teamer / qa-engineer / product-manager / optimizer / tech-lead），并扩展出 infra-architect / data-engineer / uiux-engineer / ml-trainer / slack-ops 共 12 岗位。

## 开新战役
1. 建 `missions/<战役名>/`，放剧本（目标/Phase/验证门）。
2. tech-lead 立项 → architect 出 `UPGRADE_PLAN.md`。
3. 护栏沉淀进 CHARTER（若通用）；进度落 ROADMAP/PROGRESS。
