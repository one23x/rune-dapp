# 移植这套框架到别的项目/服务器（ADOPT）

> 目标（老板原话）：**「让其它相对应的项目和服务器能够执行一样的行动和记录。」**
> 真相源 = **`one-agents/.agents/`（主平台）**。项目仓/机器**引用或同步**它，而不是各写一份。（本地 `Rune-final/.agents/` 是编辑镜像，改完先推主平台再分发。）

---

## 两种接入方式

### A) 引用式（推荐，零漂移）
别的仓不复制岗位设定，只在自己根目录放一个 `AGENTS.md` 指针：

```md
# 本仓的 agent 设定
本仓遵循 one-agents 平台团队框架（真相源：one-agents/.agents/）。
- 团队之魂/铁律/护栏 → ../one-agents/.agents/CHARTER.md
- 我在主还是项目、能碰什么 → ../one-agents/.agents/REPOS.md（见「<本仓名>」段）
- 岗位四件套 → ../one-agents/.agents/team/<role>/
记录落点：本仓 docs/ops/PROGRESS.md · docs/journey/{ROADMAP,LESSONS,daily} · docs/ops/{DECISIONS,RUNBOOK}
```

适合：rune-admin-panel / rune-console / rune-dapp 等已在 `REPOS.md` 登记的项目仓。

### B) 同步式（离线/独立服务器）
机器之间无法互相 reach 时，把 `.agents/` 整目录同步过去：

```bash
# 在 SG dev 服务器上，从主平台真相源同步到目标项目仓
rsync -a ~/projects/one-agents/.agents/ ~/projects/<target>/.agents/
# 目标仓建同名记录落点（若还没有）
mkdir -p <target>/docs/{ops,journey/daily}
```

同步式要在目标仓 `.agents/README.md` 顶部标注「**镜像副本，真相源在 one-agents/.agents/，改动回写主平台再同步**」，避免分叉。

---

## 接入清单（任何新仓/新机器照做一遍）

1. **放框架**：A 引用 或 B 同步（见上）。
2. **建记录落点**：`docs/ops/PROGRESS.md`、`docs/journey/{ROADMAP,LESSONS}.md`、`docs/journey/daily/`、`docs/ops/{DECISIONS,RUNBOOK}.md`。模板抄 Rune-final 同名文件的文件头。
3. **接 Slack 进度通知**：
   - 拷 `.claude/hooks/notify-slack.sh`（Stop hook）+ 在 `.claude/settings.json` 注册 Stop hook。
   - webhook 填 `.claude/hooks/.slack-webhook`（gitignored，别提交）。
   - 首次运行只建 baseline，不补发历史。
4. **接可执行 subagent**（可选）：拷 `.claude/agents/{rune-dev,rune-audit,rune-test}.md` + `RUNE-NORMS.md`，它们正文已指回 `.agents/team/*`。
5. **登记到 REPOS.md**：在真相源 `REPOS.md` 的四仓速查里加一段（机器位置 / 生产目标 / GitHub / 主要岗位 / 关键文件）。
6. **冒烟**：让任一 agent 读 CHARTER → REPOS（自己那段）→ 一个岗位 role.md，确认链接都通、记录落点存在。

---

## 一致性要点（别破坏「统一行动/记录」）

- **所有仓同名记录落点**：进度永远 `docs/ops/PROGRESS.md`，踩坑永远 `docs/journey/LESSONS.md`……换仓换机记录方式不变（CHARTER §6）。
- **岗位语义跨仓不变**：senior-engineer 在 one-agents 改引擎、在 admin-panel 改页，但「落码→交 red-teamer→交 qa」的流水线和交接物（AUDIT_REPORT/测试结果）格式一致。
- **改框架只改真相源**：要调岗位设定/铁律，改 `Rune-final/.agents/`，再按 A/B 让各仓生效。**禁止在镜像副本上各改各的。**
- **机器纪律继承 CHARTER §5/REPOS**：在 SG dev 多会话共用工作区 → 精确 `git add` + worktree 隔离；生产机禁 `git pull main`、备份 `prod-live`。
