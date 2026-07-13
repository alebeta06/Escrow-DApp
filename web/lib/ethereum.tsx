"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BrowserProvider,
  type Eip1193Provider,
  type JsonRpcSigner,
} from "ethers";

// 🇪🇸 NOTA: EIP-1193 con los métodos de eventos que usa MetaMask. `Eip1193Provider` de ethers solo
//    tipa `request(...)`; añadimos `on`/`removeListener` (opcionales) para suscribirnos a cambios.
interface EthereumInjectedProvider extends Eip1193Provider {
  isMetaMask?: boolean;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: EthereumInjectedProvider;
  }
}

// 🇪🇸 NOTA (clave para los tests Playwright): acceso LAZY. Se lee `window.ethereum` en tiempo de
//    ejecución, NUNCA cacheado a nivel módulo en import. Así los tests pueden inyectar un
//    `window.ethereum` mockeado antes de que el provider lo use.
function getInjectedProvider(): EthereumInjectedProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return window.ethereum;
}

export interface EthereumContextValue {
  /** ethers BrowserProvider envolviendo `window.ethereum`, o null si no hay conexión. */
  provider: BrowserProvider | null;
  /** Signer de la cuenta activa, o null si no hay conexión. */
  signer: JsonRpcSigner | null;
  /** Dirección de la cuenta conectada (checksummed) o null. */
  account: string | null;
  /** Chain id actual (número) o null. */
  chainId: number | null;
  /** true cuando hay una cuenta conectada. */
  isConnected: boolean;
  /** true si existe un provider EIP-1193 inyectado (MetaMask u otro). */
  hasMetaMask: boolean;
  /** Solicita conexión con popup (`eth_requestAccounts`). */
  connect: () => Promise<void>;
  /** Limpia el estado local (EIP-1193 no expone un "disconnect" real). */
  disconnect: () => void;
}

const EthereumContext = createContext<EthereumContextValue | null>(null);

export function EthereumProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [hasMetaMask, setHasMetaMask] = useState(false);

  // 🇪🇸 Reconstruye provider/signer/estado a partir de la lista de cuentas. Lista vacía → limpiar.
  const applyAccounts = useCallback(async (accounts: string[]) => {
    const injected = getInjectedProvider();
    if (!injected || accounts.length === 0) {
      setProvider(null);
      setSigner(null);
      setAccount(null);
      setChainId(null);
      return;
    }
    const browserProvider = new BrowserProvider(injected);
    const nextSigner = await browserProvider.getSigner();
    const network = await browserProvider.getNetwork();
    setProvider(browserProvider);
    setSigner(nextSigner);
    setAccount(await nextSigner.getAddress());
    setChainId(Number(network.chainId));
  }, []);

  const connect = useCallback(async () => {
    const injected = getInjectedProvider();
    if (!injected) return; // 🇪🇸 sin MetaMask: no-op (la UI mostrará hasMetaMask=false).
    const accounts = (await injected.request({
      method: "eth_requestAccounts",
    })) as string[];
    await applyAccounts(accounts);
  }, [applyAccounts]);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
  }, []);

  // 🇪🇸 Al montar: detectar MetaMask, auto-reconectar SIN popup si ya hay permiso, y suscribir
  //    listeners de cuenta/red. Cleanup de listeners al desmontar.
  useEffect(() => {
    const injected = getInjectedProvider();
    setHasMetaMask(Boolean(injected));
    if (!injected) return;

    // Auto-reconexión silenciosa: eth_accounts NO abre popup; devuelve cuentas si ya hay permiso.
    injected
      .request({ method: "eth_accounts" })
      .then((accounts) => applyAccounts((accounts as string[]) ?? []))
      .catch(() => {
        /* 🇪🇸 sin permiso previo o rechazo silencioso: quedamos desconectados. */
      });

    const handleAccountsChanged = (...args: unknown[]) => {
      void applyAccounts((args[0] as string[]) ?? []);
    };
    const handleChainChanged = () => {
      // 🇪🇸 patrón recomendado por MetaMask: recargar para reinicializar todo el estado on-chain.
      if (typeof window !== "undefined") window.location.reload();
    };

    injected.on?.("accountsChanged", handleAccountsChanged);
    injected.on?.("chainChanged", handleChainChanged);

    return () => {
      injected.removeListener?.("accountsChanged", handleAccountsChanged);
      injected.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [applyAccounts]);

  const value = useMemo<EthereumContextValue>(
    () => ({
      provider,
      signer,
      account,
      chainId,
      isConnected: account !== null,
      hasMetaMask,
      connect,
      disconnect,
    }),
    [provider, signer, account, chainId, hasMetaMask, connect, disconnect],
  );

  return (
    <EthereumContext.Provider value={value}>
      {children}
    </EthereumContext.Provider>
  );
}

/** Hook para consumir el contexto de Ethereum. Lanza si se usa fuera de `<EthereumProvider>`. */
export function useEthereum(): EthereumContextValue {
  const ctx = useContext(EthereumContext);
  if (ctx === null) {
    throw new Error("useEthereum debe usarse dentro de <EthereumProvider>.");
  }
  return ctx;
}
