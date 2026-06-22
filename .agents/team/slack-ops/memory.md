# MEMORY · Slack 运营 Slack-Ops

> 先查这里 + `docs/ops/SLACK-WORKSPACE-DESIGN.md` + `slack-agent/README.md`。

## 接入现状
- **绕开企业版 `slack login`/CLI**：之前群组创建卡 admin 权限/scope。用 Bot + App-Level token 走 Socket Mode 跑，等同官方 `slack create agent` 模板但不依赖 CLI。
- **两套实现**：`slack-agent/`（Python Bolt + Claude，5 工具读写 Lists，主力）；`one-agents/`（JS Bolt + Claude Agent SDK，App Home/Assistant + 反馈按钮 + session 续接，参考）。
- **部署**：美东生产机 pm2 单副本，Socket Mode 自动重连。

## 实施路线（分批，SLACK-WORKSPACE-DESIGN §五）
1. **第一批 List 数据层（能做）**：补全 客户/财务/HR/CRM 的 Lists + 示例数据，挂频道。`slackLists` 可批量建。
2. **第二批 部门分组（需 admin/MCP）**：@eng/@pm/@cs/@finance/@hr/@sales 用户组 + 侧边栏 Sections。
3. **第三批 自动化流（需 Slack MCP/CLI）**：报销/采购/入职/立项 审批流 + 表单。

## 频道前缀约定
mgmt-（公司/财务/HR/CRM）· ops-（工程）· proj-（项目内部）· client-（客户对接）。开发进度推到对应 proj- 频道。

## 敏感
- 工资单/调薪 → 私有频道 `mgmt-payroll` 限 @hr+@finance。
- 实发 = 底薪+绩效+提成+补贴 − 社保 − 公积金 − 个税。
- 凭证（bot token / app token / ANTHROPIC_API_KEY）只在 `.env`（gitignored），不回显不提交。

## 与进度框架
- 进度真相 = `docs/ops/PROGRESS.md`；Stop-hook 推新勾选 `- [x]`，每阶段一条不刷屏；webhook 在 `.claude/hooks/.slack-webhook`。我做"落到对应 List/频道"，不另立进度源。
