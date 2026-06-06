# Slack 工作空间设计 — 技术公司运营中枢

> One23x workspace 的完整运营设计:**分区(Sections)+ 部门分组(User Groups)+ 频道 + Lists + 自动化流**。对齐现有 `mgmt-/ops-/proj-/client-` 前缀,补全缺口。

## 一、部门分组(侧边栏 Sections + @用户组)

侧边栏按部门分区,每部门一个 `@用户组`(@提及 + 权限):

| 分区 | 用户组 | 职能 | 频道前缀 |
|---|---|---|---|
| 🏢 公司 Company | `@all` | 公告 / 社交 / 决策 / 会议 | all-/social/mgmt-decisions/mgmt-meetings |
| 💻 工程 Engineering | `@eng` | 开发 / 运维 / 部署 / Bug / 站点 | ops-* / claudecode-dev |
| 📦 项目 Projects | `@pm` | 各项目内部任务进度 | proj-* |
| 🤝 客户 Clients | `@cs` | 客户对接 / 需求 / 资源 / 故障 | client-* |
| 💰 财务 Finance | `@finance` | 成本 / 报销 / 采购 / 订阅 / 薪资 | mgmt-finance / mgmt-procurement |
| 👤 人力 HR | `@hr` | 入职 / 请假 / 薪资 | mgmt-onboarding / mgmt-time-off |
| 📈 销售 Sales/CRM | `@sales` | 客户管理 / 立项 / 需求池 | mgmt-crm(新) |

## 二、频道体系(现有 ✓ / 待建 +)

- **🏢 公司**: ✓all-one23x ✓social ✓mgmt-decisions ✓mgmt-meetings
- **💻 工程**: ✓ops-deployments ✓ops-bugs ✓ops-site-monitoring ✓ops-daily-standup ✓ops-helpdesk ✓claudecode-dev
- **📦 项目**: ✓proj-rune ✓proj-rune-dapp ✓proj-rune-trading ✓proj-rune-website ✓proj-corex-dapp ✓proj-corex-mining ✓proj-yly-dapp ✓proj-9heavens ✓proj-wallet-seo
- **🤝 客户**: ✓client-rune-ai ✓client-corex ✓client-yly ✓client-wallet ✓client-9heavens
- **💰 财务**: ✓mgmt-finance +mgmt-procurement(采购)
- **👤 HR**: ✓mgmt-onboarding ✓mgmt-time-off
- **📈 CRM**: +mgmt-crm(新)

## 三、各部门 Lists(数据层)

### 💻 工程(ops-*)— ✓已建
🐛 Bug · 📊 站点状态(15站点/5项目) · 💡 优化建议

### 📦 项目(proj-*)— ✓已建
📌 进度 · ✅ 任务看板 · 🎯 里程碑

### 🤝 客户(client-*,**每项目一套**)— 待建
- 📋 **需求/提成**:客户需求 + 提成金额 + 状态
- 📁 **项目资源**:交付物 / 文档 / 凭证 / 访问权限
- 🆘 **故障 Helpdesk**:报障 + 优先级 + 处理状态 + 负责人

### 💰 财务 — 部分✓
✓💵 AWS成本 · ✓📋 账单续费 · ✓💰 预算
- 🧾 **报销核销**:申请人 / 金额 / 类别 / 凭证 / 审批状态
- 🛒 **采购申请**:物品 / 金额 / 申请人 / 审批 / 采购 / 到货 / 核销
- 🔄 **订阅管理**:服务 / 周期 / 金额 / 续费日 / 负责人

### 👤 HR — ✓已建
- 👤 **员工入职**:姓名 / 岗位 / 入职日 / 入职清单进度 / 各部门对接
- 🏖 **请假**:员工 / 类型 / 起止 / 审批

### 💴 薪资体系(HR×财务)— ✓已建
- 💵 **薪资管理**(档案):员工 / 岗位 / 月薪 / 状态 → 每人一条主档
- 💴 **月度工资单**(`mgmt-finance`):员工 / 月份 / 部门 / 底薪 / 绩效 / 提成 / 补贴 / 社保个人 / 公积金个人 / 个税 / **实发** / 状态(待核算→待审批→已发放)。实发 = 底薪+绩效+提成+补贴 − 社保 − 公积金 − 个税
- 📈 **调薪记录**(`mgmt-onboarding`):员工 / 类型(涨薪/晋升/调岗/转正) / 原月薪 / 新月薪 / 原因 / 生效日 / 审批
- ⚠️ 薪资敏感,建议后续建私有频道 `mgmt-payroll` 限 @hr+@finance,把工资单/调薪迁过去

### 📈 CRM/销售 — 待建
- 🤝 **客户管理**:客户名 / 类型(新/合作) / **关联项目** / 对接人 / 阶段
- 🚀 **立项**:需求 / 客户 / 评估 / 立项状态 / → 建 proj 频道+进度
- 📝 **需求池**:需求 / 来源客户 / 优先级 / 状态

## 四、自动化流程(Slack Workflow,需 MCP/CLI 就绪)

| 流程 | 触发 → 步骤 |
|---|---|
| **报销审批** | 提交表单 → @finance 审批 → 状态更新 → 记报销 List |
| **采购审批** | 申请表单 → 审批 → 采购 → 到货确认 → 核销 |
| **员工入职** | 立项 → 自动建入职清单 → @各部门对接任务 → 完成打勾 |
| **新项目立项** | 需求 → 评估 → 立项 → 自动建 proj-频道 + client-频道 + 进度 List |
| **站点巡检** | ✓已有:每小时 curl → 报告 ops-site-monitoring |
| **进度同步** | PROGRESS.md ↔ 项目进度 List |

## 五、实施路线图(分批)

1. **第一批 — List 数据层(现在能做)**:补全 客户(每项目3)/财务(报销/采购/订阅)/HR(入职/薪资/请假)/CRM(客户/立项/需求池) 的 Lists + 填示例数据。挂到对应频道 + 共享。
2. **第二批 — 部门分组(需 admin/MCP)**:建 @eng/@pm/@cs/@finance/@hr/@sales 用户组 + 侧边栏 Sections。
3. **第三批 — 自动化流(需 Slack MCP/CLI)**:报销/采购/入职/立项 审批流 + 表单。

> List 我现在就能批量建(slackLists)。部门分组(usergroups)+ 审批流(Workflow)等 Slack MCP 工具就绪(重启加载)后做 —— 之前群组创建卡 admin 权限/scope。
