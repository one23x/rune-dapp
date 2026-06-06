# 内测上线前检查计划 — 2026-06-07

> 目标:内测版当天零事故。每项有**负责人**(👤=工作人员 / 🤖=Claude agents)和**通过标准**。
> 原则:**上午全部跑完检查 → 中午冻结变更 → 下午开闸内测**。任何 ❌ 项未关闭不开闸。

## 〇、上线前夜遗留(开检查前必须关闭)

- [ ] 🤖 TPSL builder 视野补丁部署 + 开 `HL_TPSL_ENABLED`,为活跃订阅设有效止损(10x 杠杆名义口径 SL 4-5%)
- [ ] 👤 `0x36f870980a8a4b951714399e0131B6486eE013A8`(**Polygon**)充值 ≥20 POL(gas-grant 弹药,否则 PM 侧自动补 gas 失败)
- [ ] 👤 Alchemy key 评估是否 rotate(已在对话中出现过)

## 一、基础设施健康(🤖 自动化跑,上午 9:00)

| 检查项 | 通过标准 |
|---|---|
| 引擎容器 | `one-agents-backend` healthy,`/health` ok,无 crash 记录 |
| Worker 清单 | executor / leader-watch / deposit-forwarder / tpsl 全部 started;**其余资金型 worker 保持锁定**(autoalign 等未验证的不准开) |
| pm2 管道 | trading-sync(2min)/ hl-marks(60s)/ node-access-sync / account-monitor 全 online 且日志新鲜 |
| Supabase | rollup(10min)/ breakeven cron active;视图可查;RLS 不挡 anon 读 |
| CF Pages | rune-lastest 最新部署 = GitHub main HEAD;`/version.json` 可达且 no-store |
| HL API | 滚动 1 小时日志 429=0;leader watch tick 正常节奏 |
| gas 弹药 | 0x36f8:Arbitrum ETH ≥0.003、Polygon POL ≥10 |

## 二、资金链路实弹验收(👤+🤖 联合,上午 9:30-11:00,用**专用测试钱包小额**)

1. **PM 充值三通道**(👤 操作 / 🤖 看日志):
   - [ ] Tab1 钱包直转:自动切 Polygon → gas 不足触发 gas-grant 自动补 → pUSD 到账余额刷新
   - [ ] Tab2 地址/扫码:二维码可扫、地址=引擎 smartWallet、额度提示正确
   - [ ] Tab3 跨链 PayEmbed:走通或明确降级提示(pUSD 路由可能失败 → 引导用 Tab1/2)
2. **HL 充值**(👤+🤖):
   - [ ] 直转 USDC(Arbitrum,自动切链)→ 托管 EOA → forwarder 自动补 gas 转入 HL(≤3 分钟)
   - [ ] 余额显示正确(老 AA 账户的 smart_wallet/hl_master 三键都试)
3. **跟单**(🤖 主导):
   - [ ] 测试钱包开订阅 → leader 开仓 → 自动跟进(主流币 + xyz 各验一笔);比例/cap 夹紧正确
   - [ ] builder 仓:自动划转金额合理、TPSL 看得见该仓
   - [ ] 平仓信号 → 跟随平仓 → 已实现盈亏入账
4. **提现**(👤):
   - [ ] HL 提现到 Arbitrum 地址走通;PM 提现走通
5. **授权码/节点门控**(👤):
   - [ ] 新钱包无码 → 正确拦截;兑换码 → 解锁 + 充值上限生效;节点持有人路径同验

## 三、前端体验(👤 多设备,上午并行)

- [ ] iOS Safari + 微信/钱包内置浏览器:打开即最新版(version.json 机制);切后台回来自动更新
- [ ] Android Chrome 同验
- [ ] 策略包页:只点亮真正开启的包(参数指纹判定);跟单中计数正确
- [ ] 持仓/记录页:「查看链上记录」只出现在有 tx_hash 的行,直达 explorer/tx 详情页;**绝无地址列表页链接**
- [ ] 语言切换 / 移动端布局抽查

## 四、数据与后台(👤 admin + 🤖 SQL)

- [ ] admin「交易账户」页:今日真实交易出现在 持仓/当日平仓/每日统计;手动覆盖功能可用
- [ ] 手动/持平订单:admin 录入 tx_hash 后前端正确直链(录入框若没来得及上,SQL 通道演练一遍)
- [ ] 亏损监控视图(内部)有数

## 五、风控与应急(🤖 准备,👤 知悉)

- [ ] account-monitor 告警通路测试(手动触发一条测试告警进 Slack)
- [ ] **熔断手册**(一页纸,放 Slack 置顶):
  - 停全部跟单开仓:`HL_COPY_EXECUTOR_ENABLED=false` + 重启(平仓不受影响)
  - 停单个账户:订阅 status→paused(SQL/admin)
  - 引擎回滚:基于 `prod-live` 分支 reset + rebuild(**严禁 pull GitHub main**)
  - dapp 回滚:wrangler 部署历史一键回退
- [ ] 值班表:内测时段 👤 至少一人盯 Slack 告警,🤖 随叫随到排查

## 六、变更冻结纪律(全员)

- 中午 12:00 后:**只修 P0,不上新功能**
- 引擎部署唯一出口:经主会话(tsc 前置 + 无管道吞错 + 冲突标记校验)
- dapp 部署唯一出口:SG `deploy:mainnet` 流程;部署前 `wrangler pages deployment list` 查最近部署防互盖
- 生产机 `~/one-agents` 不碰 git(在 gas-grant-prod 分支,GitHub 备份 = `prod-live`)

## 通过标准汇总

🟢 可开闸 = 〇/一/二全绿 + 三无 P0 + 五就绪。三/四的非阻塞项可带病上线但要登记。
