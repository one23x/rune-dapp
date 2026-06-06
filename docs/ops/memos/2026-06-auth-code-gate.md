# 授权码门控 — 真表 rune_auth_codes vs 空镜像;引擎 node_access 同步

状态:**已修复未上线**(门控读表修复已在线上;toast 反馈修复未上线)

## 问题
用户兑换授权码后门控不放行 / 开户仍被引擎 403 `node_required`;
或输入授权码「没反应」(后者根因见 [2026-06-toast-not-rendering.md](2026-06-toast-not-rendering.md))。

## 数据流(现行正确版)
1. dapp `useRedeemCode` → Supabase RPC `redeem_auth_code(p_code,p_wallet)`
   (security-definer,原子绑定 `rune_auth_codes.assigned_to = wallet`)。
2. 门控 `useSupabaseNodeGate` 读 **`rune_auth_codes`**(374 条真表,anon 有只读
   policy)按 `assigned_to` 判级;`rune_purchases` 判节点持有。
3. node-access-sync(pm2,SG)把已兑换码同步进引擎 RDS
   **`rune` 库** `trading.node_access` → 引擎 onboard 放行。

## 历史坑(都犯过)
- ❌ 读 `trading_auth_codes` —— 0 行空镜像,「验证成功但门控永不放行」(726f8fd 修复)。
- ❌ 引擎旧端点 `POST /v1/node/redeem-code` 读 RDS `trading.auth_codes` —— 表不存在。
- ❌ node_access 同步写进 `postgres` 库 —— 引擎读 `rune` 库,看见 0 行
  (见 [2026-06-engine-db-rune-not-postgres.md](2026-06-engine-db-rune-not-postgres.md))。

## 快速诊断
```bash
# RPC 活着吗(错码应秒回 code_not_found)
curl -s -X POST "https://mefjuecwawmjfmeofnck.supabase.co/rest/v1/rpc/redeem_auth_code" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d '{"p_code":"TEST","p_wallet":"0x0000000000000000000000000000000000000001"}'
# 某钱包绑了码没有
curl -s "https://mefjuecwawmjfmeofnck.supabase.co/rest/v1/rune_auth_codes?assigned_to=eq.<小写钱包>&select=code,node_id" -H "apikey: $ANON"
# 引擎认不认(403 node_required = node_access 还没同步到)
curl -s "https://rune-final.pages.dev/engine/users?smartWalletAddress=<钱包>"
```

## 进度
- [x] 726f8fd:门控改读 rune_auth_codes + redeem 后失效 node-gate/engine.user 查询(已上线,线上 chunk 含 `rune_auth_codes`)
- [ ] toast 反馈上线后,引导真实用户复测一轮兑码→开户全流程
- [x] 2026-06-06:0x4712…a5f8 查实 rune_auth_codes 无绑定 = 当时兑码就没成功(toast 不显示导致用户无感),新版上重试即可
- [x] 2026-06-06:同步链路验证通过——今日兑码的 0xaf76…441c / 0x10e0…0567 在引擎 /v1/node/status 均 isNode:true
- ⚠️ 兑码后开户仍失败的是另一个 bug:onboard 500,见 [2026-06-onboard-predict-500.md](2026-06-onboard-predict-500.md)
