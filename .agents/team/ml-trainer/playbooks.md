# PLAYBOOKS · 智能体训练工程师（可复用技能）

> hl-copy-ranker 飞轮的标准打法。新模型照这套：数据→训练→部署→接入→shadow→gate→重训。

## P1 · 导出训练集
- `ml/export_hl_training_set.py`：全表 mainnet → S3 `gold/hl_copy/v=<日期>`。
- 标签：用 `trading.hl_copy_signals` leader 真实成交流的 **FIFO round-trip realized PnL**（天然标签，绕开 signal_trades 决议=0 的饿死问题）。
- 特征：**因果**（只用开仓时点可知信息），防泄漏。当前 12 维 top：leader 该币经验厚度/主流币/持仓名义/滚动胜率。

## P2 · 训练 + 评估
- 撞**账户级 SageMaker 训练配额=0**（全新账户）→ 改本地 `ml/train_hl_local.py` XGBoost。
- 验收门：**test AUC > 0.5 基线**（当前 0.657）、logloss 下降（0.657<0.691）。过不了不上线。
- 申请 ml.m5.2xlarge 训练配额（L-AD0A282D）批后转云端自动重训。

## P3 · 部署（绕训练配额）
- 本地模型 → SageMaker 格式 → **serverless endpoint**（如 `hl-copy-ranker`，InService，按调用计费，绕训练配额）。
- env `SAGEMAKER_HL_RANKER_ENDPOINT=hl-copy-ranker`。

## P4 · 接入 + shadow
- `ai/sagemaker.ts` `hlCopyRankerScore()` + `hyperliquid/hl-copy-ranker-features.ts`（线上复刻同套 FIFO 特征）。
- copy-executor 每条开仓信号算一次 P(盈利)。
- **默认 shadow**：`HL_COPY_MIN_RANKER_SCORE=0`，只记 ai_inferences 不拦单。验证：分值落库 0 错误、延迟 80–120ms。

## P5 · drift 监控 + 开 gate
- worker systemd timer `ranker-eval.timer`（09:00 UTC）：放行 vs 拦截事后核对 → `trading.ranker_eval_daily`；leader-edge 成熟度 → `leader_edge_readiness`。
- 每日 join ai_inferences vs signal_trades 结果算 online-AUC；掉到 mirror 基线下告警 → 保持 shadow。
- **开 gate**：shadow 攒数据核对训练分布后设 `HL_COPY_MIN_RANKER_SCORE=0.45`——**交用户拍板**。

## 踩坑速记
- sagemaker SDK 默认装 v3 → pin <3；botocore 认 `AWS_DEFAULT_REGION`；bus 序列化后 happenedAt 是字符串须 coerce Date。
- 容器内 AWS root key → 轮换 scoped IAM（安全债）。

## 验证清单
特征因果无泄漏 / AUC>基线 / serverless endpoint InService / shadow return null 验证 / drift 监控在线 / gate 有数据 + 用户确认。
