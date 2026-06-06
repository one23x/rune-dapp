# 经验库(LESSONS)

> 格式:`L###` 编号 | 问题 → 根因 → 方案 → **复用经验**。一条尽量 ≤6 行。修完坑立即追加,grep 友好。

---

**L001 | iOS 用户拿不到新版** → iOS Safari/WKWebView 不回收后台标签,旧 SPA 常驻内存,缓存头无机会生效 → 构建注入 `__BUILD_ID__` + `/version.json`(no-store),切前台比对自动 reload + `vite:preloadError` 兜底 → **SPA 必须自带版本检测,缓存头只管"重新加载时",管不了"根本不加载"。**

**L002 | 跨链买币 process failed / 余额读不到** → Polymarket 资金在 proxy 钱包不在用户 EOA;老 AA 账户连接钱包 ≠ 记录钱包(smart_wallet/hl_master 三键) → 查 trading.users 三键定位;Supabase stats 按引擎记录钱包过滤 → **遇到"明明有钱却显示没有",第一反应:钱在哪个地址名下?**

**L003 | git add -A 卷走他人 WIP** → SG 开发机多会话共用工作区,`git add -A` 把另一会话 77 个未提交文件卷进提交并带上生产 → 重写为只含目标文件的提交;此后一律 `git worktree`(/tmp/oa-*)隔离开发 → **共享机器上:精确 add 指定文件;改引擎必用独立 worktree。**

**L004 | 冲突代码上了生产(crash-loop 2 分钟)** → `git am | tail` 管道吞退出码 + one-agents Dockerfile 不做类型检查,带冲突标记的源码被构建部署 → `set -e`、am 不接管道、构建前 grep `<<<<<<<`、部署前在 SG worktree 独立 tsc → **退出码是生命线;"能 build 成功"不等于"能跑"。**

**L005 | 跟单全平台静默瘫痪(六层洋葱)** → ①资金型 worker 默认锁(treasury 遗留)②信号生产者 leader-watch 也要单独开 ③HL 公共 API 429 ④NODE_GATING 用托管 EOA 查节点等级 → 等级 0 → 额度夹成 0 静默跳过 ⑤HIP-3 builder 资产不在主宇宙 meta ⑥builder dex 独立保证金池 → 逐层修复(详见 ops/PROGRESS 2026-06-07 与 memory)→ **"没报错"≠"在工作":executor 大量静默 skip,诊断要按条件逐项排,别只等日志。**

**L006 | HIP-3 builder DEX 协议要点** → `xyz:` 前缀资产:asset id = `100000 + dexIndex×10000 + dex内索引`;meta/allMids/clearinghouseState 必须带 `dex` 参数单查合并(默认视图看不见 builder 持仓);下单前需 `sendAsset` 把 USDC 划入该 dex(独立保证金) → **接任何"统一 API 的子宇宙",先实测三件事:资源怎么列、id 怎么算、余额/持仓在哪个视图。**

**L007 | 镜像节点只支持部分接口** → Alchemy HL 端点只代理 `clearinghouseState/spot/meta`,`userFills/allMids/exchange` 404/422 → 按类型分流:支持的走镜像降官方压力,其余走官方 → **换第三方节点前逐接口 curl 实测,别假设全兼容;架构上预留"按 host 分桶限流 + 按类型路由"。**

**L008 | 风控参数形同虚设** → 订阅 SL=60%(名义口径)在 10x 杠杆下先爆仓后触发;且 TPSL worker 看不见 builder 仓 → 口径换算(名义 3% ≈ 10x 保证金 30%)+ builder 视野补丁 → **任何百分比阈值先问口径(名义/保证金/净值),再乘杠杆心算一遍会不会先爆仓。**

**L009 | 策略包"选一个亮四个"** → 各包成员 = 同一评分池 top-N 互为子集,"已开启"只看 leader 命中 → leader+参数指纹双重匹配;长期方案 pack_key 落库 → **"归属"必须有归属字段,用集合交集推断归属迟早误判。**

**L010 | 双机/多会话部署互盖** → 多个出口对同一 CF 项目/生产机部署,后部署者盖掉前者 → dapp:部署前 `wrangler pages deployment list`;引擎:生产代码备份 GitHub `prod-live` 分支,生产机禁 `git pull main`;变更冻结窗口 → **部署出口收敛到一个,部署前先看"最近谁部过"。**

**L011 | AA 代付的边界** → 钱包抽象只代付手续费,变不出本金:gas-grant 发 POL 必须 0x36f8 真持有 POL → **"无 gas 体验"≠"无成本",弹药钱包要有余额监控(已入晨检)。**
