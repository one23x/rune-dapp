# MEMORY · 测试 QA Engineer

> 先查这里 + `docs/journey/LESSONS.md` + `docs/ops/memos/`。专治"假绿"。

## 假阳性陷阱（别被骗）
- **GET 200 ≠ 通**（L015）：admin 漏 `functions/` 时 GET 落 SPA 返回 index.html=假 200，POST 落静态 405。验证代理要看返回是不是 JSON / POST 是否 405，别只看状态码。
- **「能 build」≠「能跑」**（L004）：带冲突标记也能 build。构建前 grep `<<<<<<<` + 独立 `tsc --noEmit`。
- **「无报错」≠「在工作」**（L005）：执行器大量静默 skip 还一片绿。端到端要核对真实落库行数，不只看进程活着。
- **"real" 列名骗人**（L013）：旧 rollup 把 manual 全算进 real 列。核对真实轨要按 `source=sync` 过滤。

## 环境/连通坑
- **读 trading 数据连 `/rune` 不是 `/postgres`**（RUNBOOK/L002）：postgres 库是旧引擎遗留停在 5 月底。
- **本机连 Supabase**：直连 `db.<ref>.supabase.co:5432` 不通（IPv6-only），走 `aws-1-ap-northeast-2.pooler.supabase.com:5432`（用户名 `postgres.<ref>`）+ `gssencmode=disable`。
- **pm2 改 env**：`restart --update-env` 不生效 → `pm2 delete && start && save`。
- **新表 anon 读空**：Supabase 自动启 RLS → 补 `using(true)` select policy + NOTIFY pgrst 才读得到。

## 验证阶梯（不跳级）
testnet 全新账户 → 10 户 mainnet canary → 全量。每个门有连续通过条件（P1：50 单 testnet + 24h canary 0 拒绝）。canary 是上全量前的活体验证门，不是百分比 ramp。

## 工具
- 引擎 smoke 带 Bearer；端点列表见 REPOS one-agents 段。
- ML 验证：ranker 分值落 `ai_inferences`，shadow 模式应 return null（mirror-only），核对延迟 80–120ms、0 错误。
