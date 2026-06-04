/**
 * Module-level emitter the RuneOnboarding glue subscribes to. Lets the
 * recruit cards AND the "仪表盘" nav link re-open the Purchase modal
 * without having to hoist modal state into a provider.
 *
 * Pass a nodeId to pre-select a specific tier in the purchase modal.
 * Omit it to open the modal with the full tier picker.
 */
import type { NodeId } from "@/lib/thirdweb/contracts";

type Listener = (nodeId?: NodeId) => void;

const listeners = new Set<Listener>();

export function emitOpenPurchase(nodeId?: NodeId): void {
  listeners.forEach((l) => l(nodeId));
}

export function onOpenPurchase(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
