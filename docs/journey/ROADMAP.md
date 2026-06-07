# 路线图与里程碑

> 勾选制:阶段内全勾 = 阶段达成。变更阶段目标须老板拍板(记 `docs/ops/DECISIONS.md`)。

## Phase 0 — 平台重建与跟单打通(2026-05-30 ~ 06-07)✅ 已完成

核心目标:从旧栈迁出,把「充值 → 跟单 → 数据展示」整条命脉打通。

- [x] 基础设施迁移:爱尔兰退役,美东生产 + 新加坡开发,VPC peering
- [x] 引擎上生产(one-agents Docker ROLE=all,worker 单副本铁律)
- [x] 授权码/节点门控(Supabase-first,双库镜像同步)
- [x] 充值体系:PM 三通道 + HL 三通道、托管 EOA 自动转发、gas-grant 水龙头
- [x] **HL 跟单全链路真金打通**(六层根因修复 + HIP-3 builder DEX + 保证金自动划转,首单 xyz:BRENTOIL 成交)
- [x] 风控防线:TPSL 自动止损(42 订阅 SL3/TP8)+ account-monitor 告警 + 晨检
- [x] 数据层:trading-sync/marks/rollup → Supabase 视图 → dapp/admin
- [x] iOS 自动更新机制(version.json)

## Phase 1 — 内测(2026-06-07 启动)🎯 当前阶段

核心目标:真实用户小规模跑通全流程,**零资金事故**,收集体验问题。

- [ ] 上线晨检全绿,按 `docs/ops/LAUNCH-CHECKLIST-2026-06-07.md` 验收开闸
- [ ] 内测用户完成「绑码 → 充值 → 跟单 → 见盈亏 → 提现」完整闭环 ≥10 人
- [ ] 资金事故 = 0(止损触发不算事故,算防线工作)
- [ ] P0 问题 24h 内闭环,全部入 LESSONS
- [ ] gas-grant 双链弹药充足(0x36f8:Arb ETH + Polygon POL)
- [ ] admin 后台支撑运营:交易账户数据完整、手动单 tx_hash 录入可用
- [ ] 引擎 `prod-live` ↔ GitHub main 正式合并(autoalign 经生产验证后)
- [ ] 内测总结报告(数据:用户数/充值额/跟单笔数/胜率/问题清单)

## Phase 2 — 公测准备(目标待老板定)📋 草案

- [ ] 性能与限流:HL API 付费节点全覆盖(跟单延迟回到秒级)
- [ ] 多 leader 策略包体系化(pack_key 落库,告别参数指纹判定)
- [ ] PM 跟单链路同等打通与验证
- [ ] 风控升级:daily-supervisor 熔断启用、按节点等级差异化风控
- [~] **AI 跟单排序器(hl-copy-ranker)**:首个自研 ML 模型已训练(test AUC 0.657)+ serverless 部署 + 接入 copy-executor(2026-06-07,shadow)。待:shadow 验证后开 gate(`HL_COPY_MIN_RANKER_SCORE`)、配额批后云端自动重训
- [ ] 运营工具:批量授权码、数据看板、客服 SOP
- [ ] 安全审计:treasury/gas-grant/划转路径第三方过目

## Phase 3+ — 正式上线 / 增长(占位)

待 Phase 1 总结后规划。
