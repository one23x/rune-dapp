# Rune — 项目说明与协作规范

> 给 Claude 看的项目级指引。每次会话自动加载。详细内容在 `docs/ops/`。

## 架构总览
- **前端**:`rune-dapp`(Vite/thirdweb SPA)、`demo-rune`(Next.js skin)。
- **后台引擎**:`one-agents`(GitHub `one23x/one-agents`,即原 thirdweb-engine)= Fastify engine + ~44 个 worker,**ROLE 门控**(`api` 仅 HTTP;`worker`/`all` 启动 worker fleet,**worker 必须单副本**否则重复下单)。
- **环境布局**:美东 `us-east-1` = 生产(one-engine 部署地);新加坡 `ap-southeast-1`(`13.250.210.12`)= 开发;爱尔兰 `eu-west-1` 旧栈**已退役删除**(2026-05-30)。
- 基础设施:Terraform 在 `infra/terraform/`。

## 项目征程(必读)
- **`docs/journey/`** = 共同记忆:`ROADMAP.md`(当前阶段目标)/ `daily/`(每日战报)/ `LESSONS.md`(编号经验库)。**会话开始先读 ROADMAP 当前阶段 + 最近一篇 daily;踩坑前先 grep LESSONS;修完非平凡问题立即追加 LESSONS;收尾写 daily。**
- 技术负责人:**Alps**(称呼 Alps,平等协作)。

## 与 Claude 的配合规范(精简;详见 docs/ops/COLLABORATION.md)
1. **单一进度源 = `docs/ops/PROGRESS.md`**。里程碑勾 `- [x]`,Stop hook 自动推 Slack(每阶段一条);详细每步记「任务流水」。
2. **危险操作必先确认**:删除 / 生产部署 / 改生产网络或 RDS,执行前列清单让用户拍板;不可逆操作留回滚(如 RDS final snapshot)。
3. **凭证安全**:绝不在会回显/会提交的地方写明文 token/密码;敏感配置进 gitignored 文件(`.claude/hooks/.slack-webhook` 等);用完的 token 提醒 revoke。
4. **记录**:关键决策记 `docs/ops/DECISIONS.md`;运维操作与踩坑记 `docs/ops/RUNBOOK.md`;**反复发生的问题**(问题/根因/解决方案/进度)记 `docs/ops/memos/`,所有 agent 动手前先扫一遍其 README 索引,修复或复发时就地更新状态。
5. **长操作/跨机传输**:用后台任务 + 轮询;跨服务器传输优先「源主动出站」(入站可能不稳)。

## 关键基础设施(美东生产)
| 资源 | 地址 / 凭证 |
|---|---|
| RDS Postgres | `rune-prod-pg.cyl8yso6wymw.us-east-1.rds.amazonaws.com`,用户 `rune_admin`,密码 SSM `/rune/prod/rds/password`,含 schema `trading`/`demo`/`public` |
| ElastiCache Redis | `rune-prod-redis`(us-east-1) |
| 训练 S3 | `sagemaker-us-east-1-113725432444` + SageMaker |
| 生产机 | `52.86.40.41`(ec2-user,key `infra/terraform/rune-prod.pem`) |
| 开发机(SG) | `13.250.210.12`(ec2-user,同 key) |
| VPC peering | SG(10.1.0.0/16) ↔ US-east(10.0.0.0/16),active |

## 绕坑速查(详见 docs/ops/RUNBOOK.md)
- **AWS CLI 用 `~/.local/bin/aws`**(Homebrew 版因 python@3.14 pyexpat 坏了)。
- **aws 脚本里 `--region` 直接写,别用变量**(沙箱不拆 `$R="--region eu-west-1"`,会报 Unknown options)。
- 跨私网迁 RDS、删 VPC 的正确顺序见 RUNBOOK。
