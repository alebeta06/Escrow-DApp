import { id } from "ethers";
import { IpfsUploadError } from "./ipfs";

// 🇪🇸 NOTA: el ABI curado (abis.ts) NO incluye los fragments de error, así que ethers no puede
//    decodificar los custom errors por nombre. Los mapeamos por SELECTOR (los primeros 4 bytes =
//    keccak256 de la firma). `id(sig)` = keccak256(utf8(sig)); los 10 primeros chars ("0x"+8) son
//    el selector. Así traducimos reverts del contrato a mensajes legibles.

const CUSTOM_ERROR_SIGNATURES: ReadonlyArray<readonly [string, string]> = [
  ["TokenNotAllowed(address)", "This token is not on the allowlist."],
  ["TokenAlreadyAllowed(address)", "This token is already on the allowlist."],
  ["SameToken(address)", "Token A and Token B must be different."],
  ["ZeroAmount()", "Amounts must be greater than zero."],
  ["OperationNotActive(uint256)", "This operation is no longer active."],
  ["NotOperationCreator(uint256)", "Only the operation creator can do that."],
  ["CannotCompleteOwnOperation(uint256)", "You cannot complete your own operation."],
];

const SELECTOR_TO_MESSAGE = new Map<string, string>(
  CUSTOM_ERROR_SIGNATURES.map(([signature, message]) => [
    id(signature).slice(0, 10).toLowerCase(),
    message,
  ]),
);

/** Read a string-ish `code` field (ethers uses e.g. "ACTION_REJECTED"; EIP-1193 uses numbers). */
function getCode(err: unknown): string | number | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as Record<string, unknown>).code;
    if (typeof code === "string" || typeof code === "number") return code;
  }
  return undefined;
}

/** Read a string field (message / shortMessage) if present. */
function getStringField(err: unknown, field: string): string {
  if (err && typeof err === "object" && field in err) {
    const value = (err as Record<string, unknown>)[field];
    if (typeof value === "string") return value;
  }
  return "";
}

/**
 * Walk the error object graph looking for a revert-data hex string (the carrier varies by provider:
 * `err.data`, `err.info.error.data`, `err.error.data`, …). Returns the first `0x…` found.
 */
function findRevertData(err: unknown): string | null {
  const seen = new Set<unknown>();
  const stack: unknown[] = [err];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || typeof current !== "object" || seen.has(current)) {
      continue;
    }
    seen.add(current);
    const obj = current as Record<string, unknown>;
    const data = obj.data;
    if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) {
      return data;
    }
    for (const key of ["info", "error", "cause", "value"]) {
      if (key in obj) stack.push(obj[key]);
    }
  }
  return null;
}

/** Keep fallback messages short and single-line. */
function trimMessage(message: string): string {
  const firstLine = message.split("\n")[0].trim();
  return firstLine.length > 140 ? `${firstLine.slice(0, 140)}…` : firstLine;
}

/**
 * Map a thrown error (contract revert or wallet error) to a human-readable message.
 * Order: wallet rejection → insufficient funds → custom error selector → ERC20 heuristics → fallback.
 */
export function friendlyError(err: unknown): string {
  // 🇪🇸 La subida a IPFS ya trae un mensaje legible; no la disfracemos de error de transacción.
  if (err instanceof IpfsUploadError) return err.message;

  const code = getCode(err);
  const message = getStringField(err, "message");

  if (code === "ACTION_REJECTED" || code === 4001 || /user rejected|user denied/i.test(message)) {
    return "Transaction rejected in your wallet.";
  }

  if (code === "INSUFFICIENT_FUNDS" || /insufficient funds/i.test(message)) {
    return "Insufficient funds to cover the transaction (gas).";
  }

  const data = findRevertData(err);
  if (data) {
    const mapped = SELECTOR_TO_MESSAGE.get(data.slice(0, 10).toLowerCase());
    if (mapped) return mapped;
  }

  if (/transfer amount exceeds allowance|insufficient allowance/i.test(message)) {
    return "Token allowance too low — approve the token first.";
  }
  if (/transfer amount exceeds balance|insufficient balance/i.test(message)) {
    return "Token balance too low for this amount.";
  }

  const shortMessage = getStringField(err, "shortMessage");
  const fallback = shortMessage || message;
  return fallback ? `Transaction failed: ${trimMessage(fallback)}` : "Transaction failed.";
}
