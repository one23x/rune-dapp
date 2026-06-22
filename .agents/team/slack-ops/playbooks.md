# PLAYBOOKS · Slack 运营（可复用技能）

> 运营中枢的标准打法。详见 `docs/ops/SLACK-WORKSPACE-DESIGN.md`。

## P1 · 查 / 记 / 发（日常三动作）
- **查**：`list_directory`→`describe_list`→`read_list`（"5月工资单谁没发？""哪些报销待审？"）。
- **记**：`create_item` 写进**对应** List（报销→报销 List，进度→项目进度 List，不乱塞）。
- **发**：`post_message` 往频道发通知（按前缀 mgmt-/ops-/proj-/client-）。

## P2 · 进度同步（与开发框架对接）
进度真相在 `docs/ops/PROGRESS.md`；Stop-hook（`.claude/hooks/notify-slack.sh`）推新勾选 `- [x]` 到 Slack，每阶段一条不刷屏。我把它落到对应 proj- 频道的进度 List。**不另立进度源。**

## P3 · 审批流（需 MCP/CLI 就绪）
报销/采购/入职/立项：提交表单 → @对应用户组审批 → 状态更新 → 记对应 List。留痕可追溯。

## P4 · 建 Lists（分批实施）
1. 第一批（能做）：补全 客户/财务/HR/CRM Lists + 示例数据，`slackLists` 批量建，挂频道。
2. 第二批（需 admin/MCP）：@eng/@pm/@cs/@finance/@hr/@sales 用户组 + Sections。
3. 第三批（需 Slack MCP/CLI）：审批流 + 表单。

## P5 · 敏感数据隔离
工资单/调薪 → 私有频道 `mgmt-payroll` 限 @hr+@finance。凭证只在 `.env`(gitignored)，不回显不提交。

## 运行
`slack-agent/`：`python agent.py "..."` 离线验证 → `python app.py` 连 Slack（Socket Mode）。生产 pm2 单副本自动重连。
