"use client";

import { formatEther, formatUnits } from "ethers";
import { useBalances } from "@/hooks/useBalances";
import { shortAddress } from "@/types/operation";

/** Format a wei value to a trimmed decimal string (debug-panel precision). */
function fmt(value: bigint, decimals: number): string {
  const asString = decimals === 18 ? formatEther(value) : formatUnits(value, decimals);
  const asNumber = Number(asString);
  return Number.isFinite(asNumber)
    ? asNumber.toLocaleString(undefined, { maximumFractionDigits: 4 })
    : asString;
}

export function BalanceDebug() {
  const { data, isLoading, refetch } = useBalances();
  const tokens = data?.tokens ?? [];
  const accounts = data?.accounts ?? [];

  return (
    <section className="rounded-lg border border-foreground/15 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Balances</h2>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="rounded-md border border-foreground/25 px-3 py-1 text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
        >
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {data === null ? (
        <p className="mt-2 text-sm opacity-60">Loading…</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left opacity-60">
                <th className="py-1 pr-3 font-medium">Account</th>
                <th className="py-1 pr-3 text-right font-medium">ETH</th>
                {tokens.map((token) => (
                  <th key={token.address} className="py-1 pr-3 text-right font-medium">
                    {token.symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc, index) => (
                <tr
                  key={acc.address}
                  className={`border-t border-foreground/10 ${
                    index === 0 ? "bg-foreground/5 font-medium" : ""
                  }`}
                >
                  <td className="py-1 pr-3">
                    <span className="block">{acc.label}</span>
                    <span className="block font-mono opacity-50">
                      {shortAddress(acc.address)}
                    </span>
                  </td>
                  <td className="py-1 pr-3 text-right font-mono">{fmt(acc.eth, 18)}</td>
                  {acc.tokens.map((token) => (
                    <td key={token.address} className="py-1 pr-3 text-right font-mono">
                      {fmt(token.balance, token.decimals)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {tokens.length === 0 && (
            <p className="mt-2 text-xs opacity-50">No allowlisted tokens yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
