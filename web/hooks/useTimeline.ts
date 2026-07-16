"use client";

import { useCallback, useEffect, useState } from "react";
import { useRefresh } from "@/lib/refresh";

export interface TimelineEntry {
  type: "TokenAdded" | "OperationCreated" | "OperationCompleted" | "OperationCancelled";
  blockNumber: number;
  logIndex: number;
  timestamp: number;
  txHash: string;
  actor: string | null;
  operationId: string | null;
  token?: string;
  tokenA?: string;
  tokenB?: string;
  amountA?: string;
  amountB?: string;
  memoCID?: string;
  counterparty?: string;
}

interface UseTimelineResult {
  data: TimelineEntry[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const POLL_MS = 10000;

/**
 * Consume `GET /api/timeline` (el indexer de eventos). Refetch al montar, en cada `refresh()` global
 * (crear/completar/cancelar) y en un intervalo suave. No usa `useChainRead` porque no lee cadena.
 */
export function useTimeline(): UseTimelineResult {
  const { nonce } = useRefresh();
  const [data, setData] = useState<TimelineEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/timeline");
        const json = (await res.json()) as { entries?: TimelineEntry[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load activity.");
        if (!cancelled) {
          setData(json.entries ?? []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load activity.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [nonce, tick]);

  return { data, isLoading, error, refetch };
}
