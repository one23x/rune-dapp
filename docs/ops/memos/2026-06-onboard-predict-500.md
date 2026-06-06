# 新用户开户 500 — predictAccountAddress 参数名不兼容(signerAddress→adminAddress)

状态:**已上线**(2026-06-06 生产 backend 已打 3 处补丁并重启,全链路复测通过)

## 问题
后台创建/兑换的授权码全部正常生效(`rune_auth_codes` 绑定 ✓、Supabase 门控 ✓、
引擎 `node_access` 同步 ✓ → `/v1/node/status` 返回 `isNode:true`),
但**所有新用户** `POST /users/onboard` 返回 500 `{"error":"internal"}` →
交易账户无法激活。老用户(已有 engineEoa)不受影响(幂等返回既有账户)。
表象容易误判成「授权码无效」,实际授权码链路是好的。

## 根因(生产引擎日志实锤,2026-06-06)
`one-agents backend onboardUser`(`backend/src/services/users.ts:91`)→
`EngineClient.predictAccountAddress`(`backend/src/engine/client.ts:213`)
向 thirdweb-engine 发
`GET /contract/137/0x7F15…C60/account-factory/predict-account-address?signerAddress=…`
→ thirdweb-engine(`thirdweb/engine:latest`)返回
`400 "querystring must have required property 'adminAddress'"` —— 参数名改版了。

## 解决方案(已在生产 thirdweb-engine 上实测)
- `?adminAddress=…` → 200 `{"result":"0x533A7d…"}` ✓
- `?adminAddress=…&signerAddress=…` 两个一起发也 200 ✓(兼容旧版)
改 `client.ts:213`:
```ts
const q = new URLSearchParams({
  adminAddress: getAddress(input.adminSigner),   // 新版 thirdweb-engine 必填
  signerAddress: getAddress(input.adminSigner),  // 旧版兼容,可一起发
});
```
部署(美东生产机 52.86.40.41,`~/one-agents`):
```bash
docker compose -f docker-compose.engine.yml build backend
docker compose -f docker-compose.engine.yml up -d --no-deps backend
#                                                  ^^^^^^^^^ 必须 --no-deps:
# thirdweb-engine healthcheck 是假 unhealthy,带依赖会卡 service_healthy
```
⚠️ backend 单副本含 worker fleet,重启窗口几秒内 worker 中断,属可接受;不要起第二副本。

## 验证
```bash
curl -sX POST https://rune-ai.io/engine/users/onboard -H 'Content-Type: application/json' \
  -d '{"smartWalletAddress":"0xaf76e3653e511f2b3f1c1f6f8b8c7ada6632441c"}'
# 期望 200 {userId,...};该钱包已兑码、node/status 已放行,只卡在本 bug
```

## 实际修了 3 处(都在生产 ~/one-agents/backend,已 rebuild + 重启)
1. `engine/client.ts predictAccountAddress`:同发 `adminAddress`+`signerAddress`(本 memo 主因)。
2. `services/users.ts findUserBySmartWallet`:同时匹配 `smartWalletAddress` **或 `hlMasterAddress`**
   —— 新开户模型里连接钱包存 hlMaster、smartWalletAddress 列是 PM 智能钱包,
   只查一列导致 lookup 永远 404(dapp 会一直以为没开户)。
3. `engine/client.ts sendTransaction/deploySmartAccount`:补 `x-account-factory-address` 头
   —— 未部署的 counterfactual 账户首笔 user-op 必须带工厂地址,否则 thirdweb-engine 报
   "Failed to find factory address for account",onboard 里部署被静默 catch → 永远 pending。

## 遗留注意
- confirm 路由**只校验不部署**:历史上部署失败的 pending 用户没有自动重试部署的路径,
  需手动补发 user-op(带 x-account-factory-address 的 0-value 自调用)再 confirm。
- HL agent 模式的激活(approveAgent + approveBuilderFee)需要**用户钱包签名**,服务端不能代签。

## 进度
- [x] 2026-06-06:定位根因(引擎日志 + 双参数实测)
- [x] 2026-06-06:3 处补丁 + rebuild + 重启(--no-deps),/health ok
- [x] 2026-06-06:复测通过 —— 0xaf76…441c / 0x10e0…0567 onboard 200、lookup 200、
      智能钱包部署 mined(0x3d2c2c…/0x3212de…)、confirm → **active**、PM API key 已发
- [ ] 把 3 处补丁提交回 one23x/one-agents 仓库(生产机当前是未提交的工作树改动!)
