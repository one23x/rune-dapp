# 双机部署互盖 — 已修复的代码被旧构建覆盖回归

状态:**已缓解**(2026-06-06 重新部署修复回归;根治待 GitHub 解封后 CI 单出口)

## 问题
两台机器(本机 + SG 开发机)都能向 Cloudflare Pages 部署 dapp。任何一边
从「不含对方最新修复」的工作树构建并部署,就会把对方已上线的修复盖掉。
表现为:**昨天明明修好的 bug 今天又出现了**。

## 实锤案例
- 2026-06-06:rune-ai.io(= CF Pages `rune-final.pages.dev` 同一部署,entry
  `index-DutRJQ8H.js`)的 `shared-B7UkwfkV.js` 里 `pusdAmount` 键列表
  **没有 `balanceUsd`**(但含 `rune_auth_codes` 门控修复)→ 说明这次部署
  来自一棵「有门控修复、没余额修复」的树,把先前已上线的余额修复
  (chunk `shared-BzG3tLAY.js`)盖掉了 → 0x69c0ad… 用户余额再次显示 0
  (引擎实测余额完好:`balanceUsd:11`)。
- 更早:e893772 合并冲突事故(见 git log)。

## 根因
1. 本机 GitHub 账号 403 suspended → 两边代码经 SG 中转 bundle 同步,容易不同步。
2. ~~部署目标分裂~~ **已查清(2026-06-06,CF API 实查)**:只有一个项目
   `rune-lastest`,同时挂 `rune-final.pages.dev` + `rune-ai.io` +
   `rune.one-agents.com` 三个域名(pages.dev 子域与项目名不同是历史改名遗留)。
   `pnpm run deploy:mainnet` 目标正确,不存在第二个项目。

## 解决方案
- 短期纪律:**部署前必须先把对方的修复合进来**(检查这本备忘录的
  「已修复未上线」清单 + `git log` 双方分支),再 build + deploy。
- 部署后验证(花 30 秒):
  ```bash
  # 余额修复在不在线上
  curl -s https://rune-final.pages.dev/assets/$(curl -s https://rune-final.pages.dev/ | grep -o 'index[^"]*\.js' | head -1) \
    | grep -o 'assets/shared-[A-Za-z0-9_-]*\.js' ... # 取 shared chunk
  curl -s https://rune-final.pages.dev/assets/shared-<hash>.js | grep -c '"balanceUsd"'   # 必须 ≥1
  ```
- 中期:恢复 GitHub 后回到「单一 main 分支 → CI 部署」,禁止双机直推 CF;
  明确唯一 CF Pages 项目(rune-final 还是 rune-lastest,二选一,另一个下线)。

## 进度
- [x] 2026-06-06:本机树集齐(余额 + 门控 + toast + queryClient)重新部署上线,
      entry `index-C8qqBuq4.js` / shared `shared-CF1Iz8Qv.js`(含 balanceUsd),
      /engine Pages Function 正常,rune-ai.io 已验证
- [x] 确认部署目标:唯一项目 `rune-lastest`(三域名同挂),无分裂
- [ ] GitHub 解封后建 CI 单出口部署
- 💡 本机 wrangler 直接跑会认证失败:`.env` 里变量名是 `CLOUDFLARE_API_TOKEN_1`,
  部署前要 `export CLOUDFLARE_API_TOKEN=$(grep '^CLOUDFLARE_API_TOKEN_1=' .env | cut -d= -f2)`
