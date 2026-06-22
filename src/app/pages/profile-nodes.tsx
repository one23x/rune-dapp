/**
 * 我的节点 —— /profile/nodes
 *
 * 直链入口(不在导航/菜单),复用 BSC NodePresell(legacy presell)节点页:
 * 持有节点从 `rune_purchases` 读(QuickNode 索引 EventNodePresell),购买走
 * NodePresell 合约。原先这里曾接 Arbitrum Edition Drop(DropERC1155)购买,
 * 但买家实际买在 BSC presell 合约上 → 在此页查不到自己的节点("买了没显示")。
 * 已移除 ERC1155 通道,此页与 /nodes 共用同一套 legacy 持有/购买逻辑。
 */
export { default } from "@app/pages/nodes";
