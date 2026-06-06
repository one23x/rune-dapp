# PM 交易账户余额显示 0(balanceUsd 字段漏读)

状态:**已上线**(2026-06-06 二次部署,shared-CF1Iz8Qv.js 含 balanceUsd,rune-ai.io 已验证)

## 问题
预测跟单(Polymarket)交易账户余额显示 0 /「不见了」,但资金实际完好。
2026-06-06 再次复发(0x69c0ad35e585ab84d5BB33900d57d238799D2744 报告)。

## 根因
引擎 `GET /trade/polymarket/users/:id/pusd-balance` 返回
`{ smartWallet, balanceRaw, balanceUsd }` —— 金额在 **`balanceUsd`**。
dapp `src/app/components/copy-trading/shared.tsx` 的 `pusdAmount()` 旧键列表
`["balance","pusd","pusdBalance",...]` 不含 `balanceUsd` → 永远匹配不到 → 恒显 0。

## 解决方案
`pusdAmount()` 键列表把 `"balanceUsd"` 放最前(shared.tsx:70,本机树已含)。

验证(后端层,确认钱在):
```bash
B=https://rune-final.pages.dev/engine
curl -s "$B/users?smartWalletAddress=0x69c0ad35e585ab84d5BB33900d57d238799D2744"   # → id 4c44202f-…, engineEoa 0x27C9…
curl -s "$B/trade/polymarket/users/4c44202f-4758-4ac7-9329-a190bfd707e9/pusd-balance"
# → {"smartWallet":"0x7A925D00…","balanceRaw":"11000000","balanceUsd":11}
```
验证(前端层,确认修复在线上):线上 shared chunk `grep -c '"balanceUsd"'` ≥ 1。

## 进度
- [x] 2026-06-06(早些会话):首次修复并部署(chunk shared-BzG3tLAY.js)
- [x] 2026-06-06:复发确认 = 线上 shared-B7UkwfkV.js 无 balanceUsd;资金实测完好(11 pUSD)
- [x] 2026-06-06:随本机树重新部署,线上 shared-CF1Iz8Qv.js grep "balanceUsd" 命中 ✓
