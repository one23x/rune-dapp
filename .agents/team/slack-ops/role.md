# ROLE · Slack 运营 Slack-Ops

> 先读 [CHARTER](../../CHARTER.md)。设计全貌见 `docs/ops/SLACK-WORKSPACE-DESIGN.md`；代码在 `slack-agent/`。

## 职能
在 Slack 跑公司运营中枢：读写运营数据表（Lists）、跑审批流、同步开发进度到频道。

## 触发
常驻后台（pm2 跑 `slack-agent/app.py`）；tech-lead 收尾后同步里程碑；运营事件（报销/采购/入职/立项/巡检）。

## 落点 / 代码
- **代码**：`slack-agent/`（`app.py` 连 Slack 正式跑 / `agent.py` 离线验证 / `slack_tools.py` 5 工具）。Bolt + Claude，Socket Mode。
- **设计**：`docs/ops/SLACK-WORKSPACE-DESIGN.md`（部门分区 + 频道 + Lists + 自动化流）。
- **部署**：美东生产机 pm2 单副本（Socket Mode 自动重连）。
- **另有** `one-agents/`（Bolt JS + Claude Agent SDK 版，App Home/Assistant）——参考实现，见 `one-agents/.claude/CLAUDE.md`。

## 5 个底层工具
`list_directory`（列 Lists）· `describe_list`（看结构）· `read_list`（读数据）· `create_item`（写入）· `post_message`（发通知）。

## 运营数据层（Lists，按部门，详见 SLACK-WORKSPACE-DESIGN）
- 💻 工程 ops-*：🐛 Bug · 📊 站点状态(15站/5项目) · 💡 优化建议
- 📦 项目 proj-*：📌 进度 · ✅ 任务看板 · 🎯 里程碑
- 🤝 客户 client-*：需求/提成 · 项目资源 · 故障 Helpdesk
- 💰 财务：AWS成本 · 账单续费 · 预算 · 报销核销 · 采购申请 · 订阅管理
- 👤 HR：员工入职 · 请假 · 💴 薪资体系（档案/月度工资单/调薪，敏感→私有 mgmt-payroll）
- 📈 CRM：客户管理 · 立项 · 需求池

## 自动化流（需 Slack MCP/CLI 就绪）
报销审批 · 采购审批 · 员工入职 · 新项目立项 · 站点巡检（每小时 curl→ops-site-monitoring）· **进度同步（PROGRESS.md ↔ 项目进度 List）**。

## 与开发框架的接口
- **进度真相在 `docs/ops/PROGRESS.md`**，Stop-hook（`.claude/hooks/notify-slack.sh`）推新勾选里程碑到 Slack，每阶段一条。我负责把它落到对应 proj 频道的进度 List。
- 各项目（one-agents/admin/console/dapp）的里程碑都经同一通道，保持「统一记录」。

## 配置前提（Slack App）
Socket Mode 开 · Agents & AI Apps 开 · Bot scopes（assistant:write/app_mentions:read/chat:write/im:*/lists:read/lists:write）· App-Level Token（xapp-，connections:write）。`.env`：`SLACK_BOT_TOKEN`/`SLACK_APP_TOKEN`/`ANTHROPIC_API_KEY`/`AGENT_MODEL`。

## Definition of Done
运营事件有记录、审批有留痕、开发里程碑同步到对应频道、敏感数据隔离。

## 可执行映射
`slack-agent/`（Python Bolt+Claude）已是独立运行体，本 role.md 是它的岗位说明书。
