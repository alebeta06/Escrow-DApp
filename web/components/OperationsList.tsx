"use client";

import { useEffect, useMemo, useState } from "react";
import { Contract, formatUnits } from "ethers";
import { useEthereum } from "@/lib/ethereum";
import { useOperations } from "@/hooks/useOperations";
import { useAllowedTokens } from "@/hooks/useAllowedTokens";
import { ERC20_ABI, ESCROW_ABI } from "@/lib/abis";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { friendlyError } from "@/lib/errors";
import { ipfsGatewayUrl } from "@/lib/ipfs";
import { useRefresh } from "@/lib/refresh";
import { shortAddress, type Operation } from "@/types/operation";

interface TokenMeta {
  symbol: string;
  decimals: number;
}
interface OpTx {
  phase: "idle" | "approving" | "completing" | "cancelling" | "error";
  message: string | null;
}

const IDLE_TX: OpTx = { phase: "idle", message: null };

const STATUS_STYLE: Record<Operation["status"], string> = {
  Active: "bg-green-500/15 text-green-600 dark:text-green-400",
  Completed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  Cancelled: "bg-red-500/15 text-red-600 dark:text-red-400",
};

interface MemoState {
  status: "loading" | "loaded" | "error";
  text: string | null;
}

// 🇪🇸 Resuelve el memo desde un gateway IPFS. Es una llamada de red AISLADA por fila: si falla o
//    tarda, NUNCA tumba OperationsList — cae a mostrar el CID como enlace al gateway.
function MemoView({ cid }: { cid: string }) {
  const url = ipfsGatewayUrl(cid);
  const [state, setState] = useState<MemoState>({ status: "loading", text: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", text: null });
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`gateway ${res.status}`);
        const json = (await res.json()) as { memo?: unknown };
        const text = typeof json.memo === "string" ? json.memo : null;
        if (!cancelled) setState({ status: "loaded", text });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", text: null });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="mt-2 border-t border-foreground/10 pt-2 text-xs">
      <span className="opacity-60">Memo: </span>
      {state.status === "loading" ? (
        <span className="opacity-50">Loading memo…</span>
      ) : state.status === "loaded" && state.text ? (
        <>
          <span>{state.text}</span>{" "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap underline opacity-60"
          >
            View on IPFS
          </a>
        </>
      ) : (
        // 🇪🇸 fallo del gateway o memo sin texto: enlazamos el CID crudo, no rompemos la fila.
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono underline opacity-60"
        >
          {cid}
        </a>
      )}
    </div>
  );
}

export function OperationsList() {
  const { account, signer } = useEthereum();
  const { data: operations, refetch } = useOperations();
  const { data: tokens } = useAllowedTokens();
  const { refresh } = useRefresh();

  const [txByOp, setTxByOp] = useState<Record<string, OpTx>>({});

  // 🇪🇸 auto-refresh cada 5s (además del refresh() tras cada acción). `refetch` es estable.
  useEffect(() => {
    const timer = setInterval(() => refetch(), 5000);
    return () => clearInterval(timer);
  }, [refetch]);

  // Lookup address→{symbol,decimals} para formatear importes con símbolo.
  const tokenMeta = useMemo(() => {
    const map = new Map<string, TokenMeta>();
    for (const token of tokens ?? []) {
      map.set(token.address.toLowerCase(), { symbol: token.symbol, decimals: token.decimals });
    }
    return map;
  }, [tokens]);

  const formatAmount = (address: string, amount: bigint): string => {
    const meta = tokenMeta.get(address.toLowerCase());
    const value = formatUnits(amount, meta?.decimals ?? 18);
    return meta ? `${value} ${meta.symbol}` : `${value} ${shortAddress(address)}`;
  };

  const setOpTx = (id: string, tx: OpTx) => setTxByOp((prev) => ({ ...prev, [id]: tx }));

  const handleCancel = async (op: Operation) => {
    const id = op.id.toString();
    if (!signer) {
      setOpTx(id, { phase: "error", message: "Wallet not connected." });
      return;
    }
    try {
      setOpTx(id, { phase: "cancelling", message: null });
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.cancelOperation(op.id);
      await tx.wait();
      setOpTx(id, IDLE_TX);
      refetch();
      refresh();
    } catch (err) {
      setOpTx(id, { phase: "error", message: friendlyError(err) });
    }
  };

  const handleComplete = async (op: Operation) => {
    const id = op.id.toString();
    if (!signer) {
      setOpTx(id, { phase: "error", message: "Wallet not connected." });
      return;
    }
    try {
      // 🇪🇸 la contraparte aprueba amountB de tokenB (lo que paga), luego completa.
      setOpTx(id, { phase: "approving", message: null });
      const erc20 = new Contract(op.tokenB, ERC20_ABI, signer);
      const approveTx = await erc20.approve(ESCROW_ADDRESS, op.amountB);
      await approveTx.wait();

      setOpTx(id, { phase: "completing", message: null });
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const completeTx = await escrow.completeOperation(op.id);
      await completeTx.wait();

      setOpTx(id, IDLE_TX);
      refetch();
      refresh();
    } catch (err) {
      setOpTx(id, { phase: "error", message: friendlyError(err) });
    }
  };

  return (
    <section className="rounded-lg border border-foreground/15 p-4">
      <h2 className="text-base font-semibold">Operations</h2>

      {operations === null ? (
        <p className="mt-2 text-sm opacity-60">Loading…</p>
      ) : operations.length === 0 ? (
        <p className="mt-2 text-sm opacity-60">No operations yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {operations.map((op) => {
            const id = op.id.toString();
            const tx = txByOp[id] ?? IDLE_TX;
            const busy =
              tx.phase === "approving" || tx.phase === "completing" || tx.phase === "cancelling";
            const isCreator =
              account !== null && op.creator.toLowerCase() === account.toLowerCase();

            return (
              <li key={id} className="rounded-md border border-foreground/10 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs opacity-60">#{id}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[op.status]}`}
                  >
                    {op.status}
                  </span>
                </div>

                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="opacity-60">Creator</dt>
                  <dd className="text-right font-mono">{shortAddress(op.creator)}</dd>
                  <dt className="opacity-60">Offers</dt>
                  <dd className="text-right">{formatAmount(op.tokenA, op.amountA)}</dd>
                  <dt className="opacity-60">Requests</dt>
                  <dd className="text-right">{formatAmount(op.tokenB, op.amountB)}</dd>
                </dl>

                {op.memoCID !== "" && <MemoView cid={op.memoCID} />}

                {op.status === "Active" ? (
                  <div className="mt-3">
                    {isCreator ? (
                      <button
                        onClick={() => void handleCancel(op)}
                        disabled={busy}
                        className="w-full rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-600 transition-opacity hover:opacity-70 disabled:opacity-40 dark:text-red-400"
                      >
                        {tx.phase === "cancelling" ? "Cancelling…" : "Cancel Operation"}
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleComplete(op)}
                        disabled={busy}
                        className="w-full rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
                      >
                        {tx.phase === "approving"
                          ? "Approving…"
                          : tx.phase === "completing"
                            ? "Completing…"
                            : "Complete Operation"}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs opacity-50">Closed</p>
                )}

                {tx.phase === "error" && tx.message !== null && (
                  <p className="mt-2 text-xs text-red-500">{tx.message}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
