import { Wallet } from "ethers";

// 🇪🇸 Claves de TEST estándar de Anvil (mnemónica "test test … junk"). PÚBLICAS y deterministas;
//    NUNCA usar fuera de local. #0 (Alice) es el owner del Escrow (la misma que usa deploy.sh);
//    #1 (Bob) es la contraparte. El cambio de rol de la wallet mockeada alterna entre ambas.
export const ALICE_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const BOB_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

export type Role = "alice" | "bob";

export function pkFor(role: Role): string {
  return role === "alice" ? ALICE_PK : BOB_PK;
}

/** Deriva la address (checksummed) de una private key. Evita hardcodear direcciones. */
export function addressOf(pk: string): string {
  return new Wallet(pk).address;
}

/**
 * Address abreviada en el MISMO formato que `shortAddress` de la app (`0x1234…5678`, con `…` U+2026),
 * para asertar sobre el texto que renderiza ConnectButton.
 */
export function shortOf(pk: string): string {
  const address = addressOf(pk);
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
