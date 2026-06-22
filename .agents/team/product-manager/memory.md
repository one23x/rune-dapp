# MEMORY · 产品经理 Product Manager

> 先查这里 + `docs/journey/LESSONS.md` + `.agents/memory/`。盯用户能感知的摩擦与穿帮。

## 费用 / 对账透明（最易引爆信任）
- **会员账本是虚拟的**：余额/持仓/盈亏由公司 `member_ledger` 推导，唯一真锚=充值。**链上 explorer 跳转全部恒 null 防穿帮**（member-ledger 设计）——任何让用户能点到链上对账的入口都要砍。
- **可提 ≠ 净值**：可提=不含浮盈（防穿帮），可用=余额−保证金，净值=余额+Σ未实现。给用户的口径要一致、钳 ≥0。
- **PnL 对不上**是预期内的（扣 carry + builder fee + 虚拟账本），必须在 UI 主动解释，不能等用户自己发现。

## onboarding / 钱包摩擦
- **agent 模式多两次签名**（approveAgent + approveBuilderFee）+ 可能没 gas。已有兜底：gas-grant 水龙头（资格=授权码 OR 节点持有人，每钱包每链限 2 次，L011 弹药钱包要有余额监控）。
- **L016 跨链充值穿帮**：pUSD 没注册 bridge 时报泛化 unknown error。前端无能为力，是后端 token 注册问题——但用户只看到"充值失败"，要给可懂的提示。
- **L001 iOS 拿不到新版**：老 iOS 用户上线后仍需手动刷一次进新机制；版本检测已加 cache-bust。沟通时要预期"老用户第一次要刷新"。

## 内测体验现状（Phase 1）
- 已上线 `/funding-records` 充值提现页、admin 交易账户日期段筛选 + 经济口径两列。
- 跟单"0 开仓"常被用户当 bug，实为 funded户×活跃leader 配对问题（RUNBOOK），客服 SOP 要能解释。

## 链接
- `docs/ops/member-ledger-design.md`（账本与防穿帮）
- ROADMAP Phase 1 内测目标 / LAUNCH-CHECKLIST-2026-06-07
