import type { BrowserContext } from "@playwright/test";
import { JsonRpcProvider, NonceManager, Wallet } from "ethers";
import { addressOf, pkFor, type Role } from "./accounts";

interface Eip1193Request {
  method: string;
  params?: unknown[];
}

export interface WalletMock {
  /** Cambia la cuenta activa (cambio_rol_wallet). Deja `permitted=true` para reconectar tras reload. */
  setActor(role: Role): void;
}

/**
 * Instala un `window.ethereum` mockeado en el contexto: EIP-1193 real respaldado por una ethers
 * `Wallet` con claves de test de Anvil. Firma y envía tx REALES; solo se mockea el popup + accounts.
 *
 * 🇪🇸 El mock es un PROXY JSON-RPC passthrough a Anvil. Solo intercepta:
 *    - eth_accounts / eth_requestAccounts  → inyecta la address (modela el permiso de la extensión)
 *    - eth_sendTransaction                 → firma con la Wallet (Node) y hace broadcast
 *    Todo lo demás (eth_call, eth_estimateGas, eth_getBalance, receipts…) se reenvía tal cual.
 *    La firma vive en Node (no se puede empaquetar ethers en addInitScript); el shell del navegador
 *    delega vía un binding `exposeFunction`. ethereum.tsx lee window.ethereum LAZY, por eso funciona.
 */
export async function installWalletMock(
  context: BrowserContext,
  rpcUrl: string,
): Promise<WalletMock> {
  const rpc = new JsonRpcProvider(rpcUrl);
  const state = { pk: pkFor("alice"), permitted: false };

  // 🇪🇸 Un NonceManager por cuenta, reutilizado entre llamadas: lleva el nonce en local y lo
  //    incrementa por envío. Sin esto, dos sends consecutivos (approve→create) leen el nonce
  //    "pending" cacheado por AbstractProvider (~250ms) y, con Anvil en instamine, el segundo
  //    reutiliza el nonce del primero → "nonce has already been used". Se resincroniza desde
  //    cadena en el primer uso (contexto nuevo por test).
  const signers = new Map<string, NonceManager>();
  const signerFor = (pk: string): NonceManager => {
    let signer = signers.get(pk);
    if (!signer) {
      signer = new NonceManager(new Wallet(pk, rpc));
      signers.set(pk, signer);
    }
    return signer;
  };

  await context.exposeFunction(
    "__ethMockRequest",
    async ({ method, params }: Eip1193Request): Promise<unknown> => {
      switch (method) {
        case "eth_requestAccounts":
          state.permitted = true;
          return [addressOf(state.pk)];
        case "eth_accounts":
          return state.permitted ? [addressOf(state.pk)] : [];
        case "eth_sendTransaction": {
          const tx = (params?.[0] ?? {}) as {
            to?: string;
            data?: string;
            value?: string;
            gas?: string;
          };
          const sent = await signerFor(state.pk).sendTransaction({
            to: tx.to,
            data: tx.data,
            value: tx.value !== undefined ? BigInt(tx.value) : undefined,
            gasLimit: tx.gas !== undefined ? BigInt(tx.gas) : undefined,
          });
          return sent.hash;
        }
        default:
          return rpc.send(method, params ?? []);
      }
    },
  );

  // 🇪🇸 Shell EIP-1193 en el navegador. Corre en CADA navegación (incl. reload), ANTES de la app.
  //    No cierra sobre variables externas: delega todo en el binding Node `__ethMockRequest`.
  await context.addInitScript(() => {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    const ethereum = {
      isMetaMask: true,
      request: (args: { method: string; params?: unknown[] }) =>
        (
          window as unknown as {
            __ethMockRequest: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
          }
        ).__ethMockRequest(args),
      on: (event: string, cb: (...args: unknown[]) => void) => {
        (listeners[event] ||= []).push(cb);
        return ethereum;
      },
      removeListener: (event: string, cb: (...args: unknown[]) => void) => {
        listeners[event] = (listeners[event] ||= []).filter((h) => h !== cb);
        return ethereum;
      },
    };
    Object.defineProperty(window, "ethereum", {
      value: ethereum,
      configurable: true,
      writable: true,
    });
  });

  return {
    setActor(role: Role) {
      state.pk = pkFor(role);
      state.permitted = true;
    },
  };
}
