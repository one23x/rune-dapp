# MEMORY · 智能体训练工程师 ML Trainer

> 先查这里 + `docs/journey/PROGRESS.md`（2026-06-07 ranker 上线全记录）+ `docs/ops/RUNBOOK.md`（systemd timer）。

## hl-copy-ranker 现状（平台首个上线模型）
- **2026-06-07 训练→部署→接入全跑上线（shadow）**。意义：平台首个真正训练并上线服务的模型；此前训练管线长期饿死（signal_trades 决议=0）。
- **数据**：10340 样本 / 43.9% 正例 / 12 维因果特征 / S3 `gold/hl_copy/v=20260607`。
- **训练**：本地 XGBoost，**test AUC=0.6572**（基线 0.5），logloss 0.6566<0.6910 → 证明 HL 跟单数据可学。Top 特征：leader 该币经验厚度/主流币/持仓名义/滚动胜率。
- **部署**：serverless endpoint `hl-copy-ranker`（InService，绕账户级训练配额=0）。
- **状态**：默认 shadow（`HL_COPY_MIN_RANKER_SCORE=0`），落 ai_inferences，延迟 80–120ms，0 错误。**待**：shadow 核对分布后设 0.45 开 gate（用户拍板）；配额批后云端自动重训。

## 关键坑
- **账户级 SageMaker 训练配额=0**（全新账户）→ 云端 pipeline 失败 → 本地训练 + serverless 部署绕过。申请 ml.m5.2xlarge（L-AD0A282D→2 PENDING）。
- **防数据泄漏**：FIFO round-trip realized PnL 天然标签；线上 `hl-copy-ranker-features.ts` 复刻同套 FIFO 特征，只用开仓时点可知信息。
- **SDK 坑**：sagemaker SDK pin <3；botocore 认 `AWS_DEFAULT_REGION`；bus happenedAt 序列化后是字符串须 coerce Date。
- **容器内 AWS root key** → 轮换 scoped IAM（安全债，红队持续标记）。

## 升级目标（ROADMAP Phase 2 + Tech Upgrade P4）
- 特征 12→30+ 维（市场状态/leader 时序/微结构/拥挤度/延迟）。
- 标签 binary→风险调整收益（R-multiple / top-quantile）。
- online-AUC drift 监控（`ranker-eval.timer` 已在跑）。
- 可选 ONNX in-process（与 optimizer 接线，干掉 SageMaker 往返）。

## 运维定时器（RUNBOOK，worker 机 systemd）
- `ranker-eval.timer`(09:00 UTC)：放行 vs 拦截核对 + leader-edge 成熟度。
- `auto-subscribe-quality.timer`(每小时:07) / `copy-pnl-report.timer`(每4h:17)。

## 链接
- PROGRESS 2026-06-07 两条 ranker 详录 / RUNBOOK「运维定时器」/ optimizer memory（推理接线）/ data-engineer memory（ai_inferences 落库）
