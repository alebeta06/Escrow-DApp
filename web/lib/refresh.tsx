"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// 🇪🇸 NOTA: coordinación de refresco entre columnas SIN acoplarlas. Los hooks de lectura incluyen
//    `nonce` en sus dependencias → refetchan cuando cualquier escritura llama `refresh()`. Ej:
//    CreateOperation, tras crear, llama refresh() y OperationsList/BalanceDebug se recargan.
//    El default es no-op para que los hooks funcionen aunque no haya provider montado.

interface RefreshContextValue {
  /** Incrementa en cada refresh; úsalo como dependencia en efectos de lectura. */
  nonce: number;
  /** Dispara un refetch global de las lecturas on-chain. */
  refresh: () => void;
}

const RefreshContext = createContext<RefreshContextValue>({
  nonce: 0,
  refresh: () => {},
});

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const value = useMemo<RefreshContextValue>(() => ({ nonce, refresh }), [nonce, refresh]);
  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

/** Access the global refresh signal. Safe to call without a provider (returns a no-op). */
export function useRefresh(): RefreshContextValue {
  return useContext(RefreshContext);
}
