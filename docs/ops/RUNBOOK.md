# 运维 Runbook & 踩坑速查

爱尔兰→美东迁移期间积累的可复用运维知识。遇到类似情况直接查。

## 环境/工具
- **AWS CLI**:用 `~/.local/bin/aws`。Homebrew 的 `aws` 因 python@3.14 的 pyexpat 链接到系统 libexpat(缺符号)而崩。修法:官方 AWS CLI v2 pkg 装到 `~/.local`(`installer -pkg AWSCLIV2.pkg -target CurrentUserHomeDirectory`),`~/.zshrc` 加 `~/.local/bin` 到 PATH。
- **aws 脚本里 `--region` 必须直接写**,不要用变量 `R="--region eu-west-1"` 再 `$R` —— 沙箱执行时不做 word-split,`--region eu-west-1` 被当成一个未知选项报错。整个删除脚本可能因此静默失败(命令报错但后面无条件 echo ✓ 会误导)。

## 不稳定 EC2(sshd 反复挂起)
**症状**:实例 `running`、TCP 22 SYN 通,但 SSH 卡在 "banner exchange timeout";uptime 冻结不变;SSM agent ConnectionLost。
**根因**(本次):每 ~20s 一个幽灵 "Power key pressed short" ACPI 事件,被 **`acpid` 守护进程**拦截直接关机/挂起,**绕过** systemd-logind 的 `HandlePowerKey`。机器进 suspend → vCPU 暂停 → 全部无响应,但 EC2 层仍 running。
**排查**:`systemctl is-active acpid`;`journalctl -b | grep -i "power key\|suspend\|hibernat"`;看 uptime 是否冻结(suspend 的标志)。
**根治**:
```
systemctl stop acpid acpid.socket && systemctl mask acpid acpid.socket && pkill -9 acpid
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target \
  systemd-suspend.service systemd-hibernate.service systemd-hybrid-sleep.service
```
**临时操作手法**(机器还不稳时):`aws ec2 reboot-instances` 给干净窗口 → 每 3s 密集抢窗 ssh → 抢到立刻 `setsid <长任务> &`(脱离会话,suspend 前启动的出站任务能跑完)。reboot(不是 stop —— OS poweroff 会让实例 stopped)。

## 跨私网迁移 RDS(eu-west-1 → us-east-1,逻辑迁移进现有库)
两库都 `PubliclyAccessible=False`、各在自己 VPC。做法:
1. 临时给旧库开公网:`modify-db-instance --publicly-accessible --apply-immediately`。
2. **关键坑**:旧库子网路由表 `0.0.0.0/0` 指向 **NAT gateway**(只出不入),公网 IP 连不上。临时 `replace-route --gateway-id <igw>` 改成 IGW(原本无默认路由才能 create;有则 replace)。注意该路由表可能被多个子网/Lambda 共用,改了影响它们出站 → 用完 `replace-route` 回 NAT。
3. SG 放行源 IP 的 5432(美东 EC2 出口 IP)。
4. 美东 EC2 用 `docker run postgres:18 pg_dump <src> -Fc` → `pg_restore --no-owner --no-acl -d <dst>`(版本要匹配源库,用 docker 镜像最省事)。
5. 完事改回路由 NAT + 撤销 publicly-accessible + 撤销 SG 规则。

## 删除整个 VPC 栈(依赖顺序)
1. **应用层**(可并行):Lambda、EC2 terminate、RDS delete(**先关 deletion protection** `--no-deletion-protection`,再 `--final-db-snapshot-identifier` 留快照)、ElastiCache delete-replication-group、SQS、SNS、CloudWatch alarms、S3(版本桶要先删所有 version 再 `rb`)、EBS 快照。
2. 等 EC2/RDS/ElastiCache 删完 + 托管 ENI 自动释放(轮询,RDS ~10min)。
3. 2×NAT gateway(按小时收费,优先)→ 等 deleted。
4. 释放 EIP(NAT 删后才能 release)。
5. 子网(ENI 释放后才能删)。
6. IGW:detach 再 delete。
7. 路由表(留 main)、SG(**互引的先 `revoke-security-group-ingress/egress` 删光规则,再 delete**,否则循环依赖删不掉)。
8. VPC(自动带走 main 路由表 + default SG)。

## EBS 取出 stopped 机器上的文件(绕过坏掉的 sshd)
`stop-instances` → `create-snapshot <root-vol>` → 等 100% → `copy-snapshot` 跨区 → 等 100% → `create-volume`(目标 EC2 **同 AZ**)→ `attach-volume /dev/sdf` → Nitro 上是 `/dev/nvme1n1`,mount 最大分区(`nvme1n1p1`)→ 读文件 → 用完 umount/detach/delete-volume。git 操作挂载的 repo 加 `git config --global --add safe.directory <path>`。

## Slack 进度通知
`.claude/hooks/notify-slack.sh`(Stop hook)。webhook 填 `.claude/hooks/.slack-webhook`。它只推 PROGRESS.md 里新勾选的 `- [x]`,每阶段一条。

## RDS 双库陷阱(rune vs postgres)+ pm2 env 烤死
- `rune-prod-pg` 上有**两个库各带一套 trading schema**:`rune` = 生产引擎(one-agents-backend Docker `DATABASE_URL` 指它)实际读写;`postgres` = 旧引擎阶段遗留(数据停在 2026-05 月底)。**任何读 trading 数据的脚本必须连 `/rune`**。2026-06-06 trading-sync 曾因连 `/postgres` 导致 Supabase 数据滞后/缺新用户。
- **pm2 改 env 不要用 `restart --update-env`**:进程创建时的 env(含 .env 注入的)烤在 pm2 dump 里,sync.mjs 又是 process.env 优先,改 .env 后必须 `pm2 delete <name> && pm2 start ... && pm2 save` 才生效。
- 本机连 Supabase:直连 `db.<ref>.supabase.co:5432` 不通(IPv6-only),走 `aws-1-ap-northeast-2.pooler.supabase.com:5432`(用户名 `postgres.<ref>`)且加 `gssencmode=disable`。
