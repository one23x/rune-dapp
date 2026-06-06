# 协作规范(Claude × 你)

经过爱尔兰→美东大迁移沉淀下来的配合方式。目标:你少盯、决策点清晰、过程可追溯。

## 1. 进度管理
- **单一进度源**:`docs/ops/PROGRESS.md`。
  - 「里程碑」区:每个任务阶段一行 `- [ ]` / `- [x]`。勾上即视为完成。
  - 「任务流水」区:详细记录每步操作(新的在最上),供回溯。
- **Slack 通知**:`.claude/hooks/notify-slack.sh`(Stop hook)在每次会话结束时,把 PROGRESS.md 里**新勾选**的里程碑推到 Slack,**每阶段一条,不刷屏**。
  - webhook 配在 `.claude/hooks/.slack-webhook`(gitignored)。当前为空占位 → 填入有效 `https://hooks.slack.com/services/...` 即生效,无需改代码。
  - 首次运行只建 baseline(不补发历史)。
- **task 工具**:会话内用 TaskCreate/TaskUpdate 做即时任务跟踪;跨会话的长期进度落到 PROGRESS.md。

## 2. 危险操作三原则
1. **先确认**:删除资源 / 生产部署 / 改生产网络或数据库 / 释放 EIP 这类不可逆或影响生产的操作,**先列清单 + 影响 + 选项,让你拍板**再执行。
2. **留后路**:不可逆操作尽量留回滚点(删 RDS 留 final snapshot;改文件留 `.bak`;改网络记下原值)。
3. **小步验证**:大批量删除/变更分阶段执行 + 每阶段核实,不一把梭。

## 3. 凭证与安全
- 明文 token/密码**绝不**写进会回显到对话或会被 git 提交的地方。
- 敏感配置 → gitignored 文件(`.claude/hooks/.slack-webhook`、`.claude/settings.local.json`)。
- 用完的临时 token(如 push 用的 PAT)→ **主动提醒 revoke**。
- 脱敏展示:看 env 只看 key 名和 host,不打印密码段。

## 4. 记录分工
| 放哪 | 记什么 |
|---|---|
| `PROGRESS.md` | 进度:里程碑勾选 + 每步流水 |
| `DECISIONS.md` | 关键决策:选了什么方案、为什么、否决了什么 |
| `RUNBOOK.md` | 运维动作 + 踩坑与解法(可复用) |
| `~/.claude/.../memory/` | 跨会话持久事实(基础设施、架构、根因) |

## 5. 执行习惯(从迁移中总结)
- **长操作**:后台任务(`run_in_background`)+ 轮询读输出,不阻塞。
- **跨服务器传输**:优先「源主动出站」(老服务器入站 sshd 不稳时,让它 rsync 推出去)。
- **不稳的机器**:reboot 给干净窗口 → 密集抢窗 → `setsid` 启动持久任务(任务脱离 ssh 会话,断了也跑完)。
- **AWS 批量操作**:`--region` 直写;删除按依赖顺序;删前先 describe 核实。
