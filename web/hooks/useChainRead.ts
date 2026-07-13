"use client";

import { useCallback, useEffect, useState } from "react";
import type { BrowserProvider } from "ethers";
import { useEthereum } from "@/lib/ethereum";
import { useRefresh } from "@/lib/refresh";

export interface ChainRead<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Shared skeleton for on-chain reads. Runs `loader` with the connected `BrowserProvider`, and
 * re-runs on: provider change, global refresh `nonce`, or a local `refetch()`.
 *
 * 🇪🇸 NOTA: `cancelled` evita setState tras unmount. `loader` se omite a propósito de las deps del
 *    efecto (se recrea en cada render); los loaders son puros (solo usan `provider` + constantes),
 *    así que reejecutar por su identidad causaría un bucle sin aportar nada.
 */
export function useChainRead<T>(
  loader: (provider: BrowserProvider) => Promise<T>,
): ChainRead<T> {
  const { provider } = useEthereum();
  const { nonce } = useRefresh();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!provider) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    loader(provider)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load on-chain data.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, nonce, tick]);

  return { data, isLoading, error, refetch };
}
