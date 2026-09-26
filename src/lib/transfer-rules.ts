/* Pure stock transfer rules, free of database code so they can be unit
   tested. lib/actions/transfers.ts applies them. */

export const TransferStatusValues = ["DRAFT", "SENT", "RECEIVED", "CANCELLED"] as const;
export type TransferStatus = (typeof TransferStatusValues)[number];

/** Draft can be sent or cancelled; a sent transfer can only be received. */
export function canTransitionTransfer(from: TransferStatus, to: TransferStatus): boolean {
  if (from === "DRAFT") return to === "SENT" || to === "CANCELLED";
  if (from === "SENT") return to === "RECEIVED";
  return false;
}

export type TransferAction = "view" | "edit" | "send" | "cancel" | "receive";

/**
 * Who may do what. Unrestricted users may do everything. An employee
 * locked to a branch sees transfers touching it, prepares, sends and
 * cancels ones leaving it, and receives ones arriving at it.
 */
export function canActOnTransfer(
  lockedBranchId: string | null,
  transfer: { fromBranchId: string; toBranchId: string },
  action: TransferAction
): boolean {
  if (!lockedBranchId) return true;
  const fromMine = transfer.fromBranchId === lockedBranchId;
  const toMine = transfer.toBranchId === lockedBranchId;
  if (action === "view") return fromMine || toMine;
  if (action === "receive") return toMine;
  return fromMine;
}

/** Why a route can't be used, or null when it can. */
export function transferRouteError(
  fromBranchId: string,
  toBranchId: string,
  activeBranchIds: string[]
): "transfer-same-branch" | "branch-inactive" | null {
  if (fromBranchId === toBranchId) return "transfer-same-branch";
  if (!activeBranchIds.includes(fromBranchId) || !activeBranchIds.includes(toBranchId)) return "branch-inactive";
  return null;
}

export function formatTransferNumber(sequence: number): string {
  return `TR-${String(sequence).padStart(4, "0")}`;
}

/** Next number from the highest one used so far ("TR-0007" → 8). */
export function nextTransferSequence(existing: string[]): number {
  let max = 0;
  for (const n of existing) {
    const m = /^TR-(\d+)$/.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export type LotOut = {
  productId: string;
  lotNumber: string;
  expiresAt: Date | null;
  receivedAt: Date;
  source: string;
  /** Negative: units that left the lot when the transfer was sent. */
  quantity: number;
};

/**
 * Lots to recreate at the destination: the same lot numbers, expiry and
 * original receipt date (so oldest first picking still holds), with the
 * units that left each one.
 */
export function planLotArrivals(outs: LotOut[]): (Omit<LotOut, "quantity"> & { quantity: number })[] {
  const byLot = new Map<string, Omit<LotOut, "quantity"> & { quantity: number }>();
  for (const o of outs) {
    const key = `${o.productId}\u0000${o.lotNumber}`;
    const entry = byLot.get(key);
    if (entry) entry.quantity += -o.quantity;
    else byLot.set(key, { ...o, quantity: -o.quantity });
  }
  return [...byLot.values()].filter((l) => l.quantity > 0);
}

/** Badge colour per status, shared by the list and detail pages. */
export const TRANSFER_TONE = { DRAFT: "slate", SENT: "blue", RECEIVED: "green", CANCELLED: "red" } as const;
