"use client";

import { useTimeline, type TimelineEntry } from "@/hooks/useTimeline";
import { shortAddress } from "@/types/operation";

const LABEL: Record<TimelineEntry["type"], string> = {
  TokenAdded: "Token added",
  OperationCreated: "Operation created",
  OperationCompleted: "Operation completed",
  OperationCancelled: "Operation cancelled",
};

// 🇪🇸 Tiempo relativo legible ("2m ago"). El timestamp REAL del bloque es el valor diferencial de
//    esta vista frente a getAllOperations(); el absoluto va en el `title`/`dateTime`.
function timeAgo(unixSeconds: number): string {
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function Timeline() {
  const { data, isLoading, error } = useTimeline();

  return (
    <section className="rounded-lg border border-foreground/15 p-4">
      <h2 className="text-base font-semibold">Activity</h2>
      <p className="mt-1 text-xs opacity-60">
        Event timeline from the on-chain indexer — who did what, and when.
      </p>

      {error !== null ? (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      ) : data === null ? (
        <p className="mt-2 text-sm opacity-60">{isLoading ? "Loading activity…" : "Loading…"}</p>
      ) : data.length === 0 ? (
        <p className="mt-2 text-sm opacity-60">No activity yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {data.map((e) => {
            const when = new Date(e.timestamp * 1000);
            return (
              <li
                key={`${e.txHash}-${e.logIndex}`}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0 truncate">
                  <span className="font-medium">{LABEL[e.type]}</span>
                  {e.operationId !== null && <span className="opacity-60"> · #{e.operationId}</span>}
                  {e.actor !== null && (
                    <span className="font-mono text-xs opacity-60"> · {shortAddress(e.actor)}</span>
                  )}
                  {e.type === "TokenAdded" && e.token && (
                    <span className="font-mono text-xs opacity-60"> · {shortAddress(e.token)}</span>
                  )}
                </div>
                <time
                  dateTime={when.toISOString()}
                  title={when.toLocaleString()}
                  className="whitespace-nowrap text-xs opacity-50"
                >
                  {timeAgo(e.timestamp)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
