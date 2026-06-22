/**
 * StrategyHub — /strategy/hl 的入口。
 * 现为「分步门槛」向导:资格验证→钱包充值→选择策略→交易引擎(详见 StrategyFlow)。
 * 全部门槛通过且选好策略时,StrategyFlow 直接渲染引擎页(自带暂停/切换页眉)。
 */
import { StrategyFlow } from "./strategy-flow";

export function StrategyHub() {
  return (
    <div className="px-4 pt-4 lg:px-6">
      <StrategyFlow />
    </div>
  );
}

export default StrategyHub;
