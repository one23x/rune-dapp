import { useState, useCallback } from "react";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { approve, transfer } from "thirdweb/extensions/erc20";
import { prepareContractCall, waitForReceipt, getContract, readContract } from "thirdweb";
import { useThirdwebClient } from "./use-thirdweb";
import {
  getUsdtContract,
  getVaultContract,
  getNodeContract,
  getSwapRouterContract,
  usdToUsdtUnits,
  VAULT_CONTRACT_ADDRESS,
  NODE_CONTRACT_ADDRESS,
  SWAP_ROUTER_ADDRESS,
  VAULT_V3_ADDRESS,
  VAULT_ABI,
  NODE_ABI,
  SWAP_ROUTER_ABI,
  BSC_CHAIN,
  USDT_ADDRESS,
  USDC_ADDRESS,
  RUNE_LOCK_CONTRACT_ADDRESS,
  EMBER_BURN_CONTRACT_ADDRESS,
} from "@app/lib/contracts";
import { VIP_PLANS } from "@app/lib/data";

export type PaymentStatus =
  | "idle"
  | "approving"
  | "paying"
  | "confirming"
  | "recording"
  | "success"
  | "error";

export function usePayment() {
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const account = useActiveAccount();
  const { client } = useThirdwebClient();
  const { mutateAsync: sendTransaction } = useSendTransaction({
    payModal: {
      theme: "dark",
      buyWithCrypto: {},
      buyWithFiat: {},
    },
  });

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(null);
    setError(null);
  }, []);

  const markSuccess = useCallback(() => {
    setStatus("success");
  }, []);

  /**
   * Shared approve + call + confirm flow.
   * @param contractAddress - The payment contract to call
   * @param spenderAddress - Address to approve USDT to
   * @param amountUsd - USD amount for approval
   * @param prepareTx - Function that prepares the contract call transaction
   */
  const _executePayment = useCallback(
    async (
      spenderAddress: string,
      amountUsd: number,
      prepareTx: () => ReturnType<typeof prepareContractCall>,
    ): Promise<string> => {
      if (!account) throw new Error("Wallet not connected");
      if (!client) throw new Error("Thirdweb client not ready");

      setStatus("approving");
      setError(null);
      setTxHash(null);

      try {
        const usdtContract = getUsdtContract(client);

        // Step 1: Approve max USDT spend (one-time unlimited)
        const maxUint = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        const approveTx = prepareContractCall({
          contract: usdtContract,
          method: "function approve(address spender, uint256 amount) returns (bool)",
          params: [spenderAddress, maxUint],
        });
        const approveResult = await sendTransaction(approveTx);
        await waitForReceipt({
          client,
          chain: BSC_CHAIN,
          transactionHash: approveResult.transactionHash,
        });

        // Step 2: Execute contract call (fixed gas to avoid estimation revert)
        setStatus("paying");
        const tx = prepareTx();
        // Add gas override to skip estimation
        (tx as any).gas = BigInt(600000);
        const payResult = await sendTransaction(tx);

        // Step 3: Wait for on-chain confirmation
        setStatus("confirming");
        const receipt = await waitForReceipt({
          client,
          chain: BSC_CHAIN,
          transactionHash: payResult.transactionHash,
        });

        if (receipt.status === "reverted") {
          throw new Error("Transaction reverted");
        }

        const confirmedHash = receipt.transactionHash;
        setTxHash(confirmedHash);
        setStatus("recording");
        return confirmedHash;
      } catch (err: any) {
        const message = err?.message || "Payment failed";
        setError(message);
        setStatus("error");
        throw err;
      }
    },
    [account, client, sendTransaction],
  );

  // ── Vault deposit ──
  const payVaultDeposit = useCallback(
    async (amountUsd: number, planType: string): Promise<string> => {
      if (!VAULT_CONTRACT_ADDRESS) throw new Error("Vault contract not configured");
      if (!client) throw new Error("Thirdweb client not ready");
      const amount = usdToUsdtUnits(amountUsd);
      return _executePayment(VAULT_CONTRACT_ADDRESS, amountUsd, () =>
        prepareContractCall({
          contract: getVaultContract(client),
          method: VAULT_ABI[0],
          params: [amount, planType],
        }),
      );
    },
    [client, _executePayment],
  );

  // ── Node purchase (V1 — direct USDT to Node contract) ──
  const payNodePurchase = useCallback(
    async (nodeType: string, paymentMode: string = "FULL"): Promise<string> => {
      if (!NODE_CONTRACT_ADDRESS) throw new Error("Node contract not configured");
      if (!client) throw new Error("Thirdweb client not ready");
      const contributions: Record<string, number> = { MINI: 100, MAX: 600 };
      const amountUsd = contributions[nodeType] || 0;
      return _executePayment(NODE_CONTRACT_ADDRESS, amountUsd, () =>
        prepareContractCall({
          contract: getNodeContract(client),
          method: NODE_ABI[0],
          params: [nodeType, USDT_ADDRESS],
        }),
      );
    },
    [client, _executePayment],
  );

  // ── Node purchase V2 (thirdweb Pay → USDC → Vault.purchaseNodePublic → BatchBridge → ARB) ──
  const payNodePurchaseV2 = useCallback(
    async (nodeType: string): Promise<string> => {
      if (!client) throw new Error("Thirdweb client not ready");
      if (!account) throw new Error("Wallet not connected");

      // Node tier → whole-USD price. Includes the legacy MINI/MAX presell tiers
      // plus the 5 on-chain tiers from NODE_META (FOUNDER/SUPER/ADVANCED/MID/INITIAL).
      // The contract resolves the authoritative price on-chain; this map only
      // sizes the approve() amount, so it must cover every nodeType the UI sells.
      const prices: Record<string, number> = {
        MINI: 100, MAX: 600,
        FOUNDER: 50000, SUPER: 10000, ADVANCED: 5000, MID: 2500, INITIAL: 1000,
      };
      const amountUsd = prices[nodeType] || 0;
      if (!amountUsd) throw new Error("Invalid node type");

      const usdcAmount = BigInt(Math.floor(amountUsd * 1e18));

      setStatus("paying");
      setError(null);
      setTxHash(null);

      try {
        // Detect token: prefer USDC, fallback USDT
        const usdcC = getContract({ client, chain: BSC_CHAIN, address: USDC_ADDRESS });
        const usdtC = getUsdtContract(client);
        let payToken = USDC_ADDRESS;
        let tokenC = usdcC;
        try {
          const usdcBal = await readContract({ contract: usdcC, method: "function balanceOf(address) view returns (uint256)", params: [account.address] });
          if (BigInt(usdcBal.toString()) < usdcAmount) { payToken = USDT_ADDRESS; tokenC = usdtC; }
        } catch { payToken = USDT_ADDRESS; tokenC = usdtC; }

        // Step 1: Approve token to Vault
        const approveTx = approve({ contract: tokenC, spender: VAULT_V3_ADDRESS, amountWei: usdcAmount });
        const approveResult = await sendTransaction(approveTx);
        await waitForReceipt({ client, chain: BSC_CHAIN, transactionHash: approveResult.transactionHash });

        // Step 2: Vault.purchaseNodePublic
        setStatus("paying");
        const vault = getContract({ client, chain: BSC_CHAIN, address: VAULT_V3_ADDRESS });
        const tx = prepareContractCall({
          contract: vault,
          method: "function purchaseNodePublic(string nodeType, address token, uint256 amount)",
          params: [nodeType, payToken, usdcAmount],
        });
        const payResult = await sendTransaction(tx);

        setStatus("confirming");
        const receipt = await waitForReceipt({
          client,
          chain: BSC_CHAIN,
          transactionHash: payResult.transactionHash,
        });

        if (receipt.status === "reverted") throw new Error("Transaction reverted");

        const confirmedHash = receipt.transactionHash;
        setTxHash(confirmedHash);
        setStatus("recording");

        // Trigger immediate node fund relay (3-hop privacy)
        try {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/flush-node-pool`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
        } catch { /* non-critical */ }

        return confirmedHash;
      } catch (err: any) {
        setError(err?.message || "Payment failed");
        setStatus("error");
        throw err;
      }
    },
    [account, client, sendTransaction],
  );

  // ── VIP subscribe (BSC USDT → server wallet → splitter → distribution) ──
  const payVIPSubscribe = useCallback(
    async (planKey: keyof typeof VIP_PLANS): Promise<{ txHash?: string; profile?: any }> => {
      if (!client) throw new Error("Thirdweb client not ready");
      if (!account) throw new Error("Wallet not connected");

      const plan = VIP_PLANS[planKey];
      if (!plan) throw new Error("Invalid VIP plan");

      const receiverAddress = import.meta.env.VITE_VIP_RECEIVER_ADDRESS || "0x927eDe64b4B8a7C08Cf4225924Fa9c6759943E0A";

      setStatus("paying");
      setError(null);
      setTxHash(null);

      try {
        // Transfer BSC USDT to server wallet VIP address
        const usdtContract = getUsdtContract(client);
        const tx = transfer({
          contract: usdtContract,
          to: receiverAddress,
          amount: plan.price,
        });
        const payResult = await sendTransaction(tx);

        setStatus("confirming");
        const receipt = await waitForReceipt({
          client,
          chain: BSC_CHAIN,
          transactionHash: payResult.transactionHash,
        });

        if (receipt.status === "reverted") throw new Error("Transaction reverted");

        const confirmedHash = receipt.transactionHash;
        setTxHash(confirmedHash);

        // Activate VIP via API
        setStatus("recording");
        const resp = await fetch("/api/subscribe-vip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: account.address, txHash: confirmedHash, planLabel: planKey }),
        });

        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || "VIP activation failed");

        return { txHash: confirmedHash, profile: result.profile };
      } catch (err: any) {
        const message = err?.message || "Payment failed";
        setError(message);
        setStatus("error");
        throw err;
      }
    },
    [account, client, sendTransaction],
  );

  // ── RUNE Lock (pay USDT → contract buys & locks RUNE) ──
  const payRuneLock = useCallback(
    async (amountUsd: number): Promise<string> => {
      if (!RUNE_LOCK_CONTRACT_ADDRESS) throw new Error("RUNE_LOCK_CONTRACT not configured");
      if (!client) throw new Error("Thirdweb client not ready");
      if (!account) throw new Error("Wallet not connected");
      setStatus("approving");
      setError(null);
      setTxHash(null);
      try {
        const usdtContract = getUsdtContract(client);
        const rawAmount = usdToUsdtUnits(amountUsd);
        const maxUint = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        const approveTx = prepareContractCall({
          contract: usdtContract,
          method: "function approve(address spender, uint256 amount) returns (bool)",
          params: [RUNE_LOCK_CONTRACT_ADDRESS as `0x${string}`, maxUint],
        });
        const approveResult = await sendTransaction(approveTx);
        await waitForReceipt({ client, chain: BSC_CHAIN, transactionHash: approveResult.transactionHash });
        setStatus("paying");
        const lockContract = getContract({ client, chain: BSC_CHAIN, address: RUNE_LOCK_CONTRACT_ADDRESS as `0x${string}` });
        const tx = prepareContractCall({
          contract: lockContract,
          method: "function depositUSDT(uint256 amount) external",
          params: [rawAmount],
        });
        (tx as any).gas = BigInt(600000);
        const payResult = await sendTransaction(tx);
        setStatus("confirming");
        const receipt = await waitForReceipt({ client, chain: BSC_CHAIN, transactionHash: payResult.transactionHash });
        if (receipt.status === "reverted") throw new Error("Transaction reverted");
        setTxHash(receipt.transactionHash);
        setStatus("recording");
        return receipt.transactionHash;
      } catch (err: any) {
        setError(err?.message || "Payment failed");
        setStatus("error");
        throw err;
      }
    },
    [account, client, sendTransaction],
  );

  // ── FIRE Burn (pay USDT → contract buys & burns RUNE) ──
  const payEmberBurn = useCallback(
    async (amountUsd: number): Promise<string> => {
      if (!EMBER_BURN_CONTRACT_ADDRESS) throw new Error("FIRE burn contract not configured");
      if (!client) throw new Error("Thirdweb client not ready");
      if (!account) throw new Error("Wallet not connected");
      setStatus("approving");
      setError(null);
      setTxHash(null);
      try {
        const usdtContract = getUsdtContract(client);
        const rawAmount = usdToUsdtUnits(amountUsd);
        const maxUint = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
        const approveTx = prepareContractCall({
          contract: usdtContract,
          method: "function approve(address spender, uint256 amount) returns (bool)",
          params: [EMBER_BURN_CONTRACT_ADDRESS as `0x${string}`, maxUint],
        });
        const approveResult = await sendTransaction(approveTx);
        await waitForReceipt({ client, chain: BSC_CHAIN, transactionHash: approveResult.transactionHash });
        setStatus("paying");
        const burnContract = getContract({ client, chain: BSC_CHAIN, address: EMBER_BURN_CONTRACT_ADDRESS as `0x${string}` });
        const tx = prepareContractCall({
          contract: burnContract,
          method: "function depositUSDT(uint256 amount) external",
          params: [rawAmount],
        });
        (tx as any).gas = BigInt(600000);
        const payResult = await sendTransaction(tx);
        setStatus("confirming");
        const receipt = await waitForReceipt({ client, chain: BSC_CHAIN, transactionHash: payResult.transactionHash });
        if (receipt.status === "reverted") throw new Error("Transaction reverted");
        setTxHash(receipt.transactionHash);
        setStatus("recording");
        return receipt.transactionHash;
      } catch (err: any) {
        setError(err?.message || "Payment failed");
        setStatus("error");
        throw err;
      }
    },
    [account, client, sendTransaction],
  );

  return {
    payVaultDeposit,
    payNodePurchase,
    payNodePurchaseV2,
    payVIPSubscribe,
    payRuneLock,
    payEmberBurn,
    status,
    txHash,
    error,
    reset,
    markSuccess,
  };
}

/** Status label helper for UI */
export function getPaymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case "approving":  return "Approving USDT...";
    case "paying":     return "Sending payment...";
    case "confirming": return "Confirming on-chain...";
    case "recording":  return "Recording to database...";
    case "success":    return "Payment confirmed";
    case "error":      return "Payment failed";
    default:           return "";
  }
}
