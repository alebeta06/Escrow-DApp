import type { Result } from "ethers";

// 🇪🇸 NOTA: el contrato devuelve `status` como uint8 (0=Active, 1=Completed, 2=Cancelled). Aquí lo
//    traducimos a un union legible para el frontend; SOLO 'Active' habilita botones de acción.
export type OperationStatus = "Active" | "Completed" | "Cancelled";

/** Frontend-friendly shape of the on-chain `Operation` struct. */
export interface Operation {
  id: bigint;
  creator: string;
  counterparty: string;
  tokenA: string;
  tokenB: string;
  amountA: bigint;
  amountB: bigint;
  status: OperationStatus;
  memoCID: string;
}

const STATUS_BY_INDEX: readonly OperationStatus[] = [
  "Active",
  "Completed",
  "Cancelled",
];

/**
 * Map an ethers decoded tuple (named `Result`) into a typed {@link Operation}.
 *
 * 🇪🇸 NOTA: ethers v6 devuelve un `Result` array-like con acceso por nombre (raw.creator, raw.id…)
 *    gracias a los `components` del ABI. Convertimos el uint8 de status al union con el índice.
 */
export function toOperation(raw: Result): Operation {
  const statusIndex = Number(raw.status);
  const status = STATUS_BY_INDEX[statusIndex] ?? "Active";
  return {
    id: raw.id as bigint,
    creator: raw.creator as string,
    counterparty: raw.counterparty as string,
    tokenA: raw.tokenA as string,
    tokenB: raw.tokenB as string,
    amountA: raw.amountA as bigint,
    amountB: raw.amountB as bigint,
    status,
    memoCID: raw.memoCID as string,
  };
}

/** Abbreviate an address as `0x1234…5678` for compact display. */
export function shortAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
