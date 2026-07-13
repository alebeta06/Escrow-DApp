"use client";

import { useState } from "react";
import { Contract, isAddress } from "ethers";
import { useEthereum } from "@/lib/ethereum";
import { useOwner } from "@/hooks/useOwner";
import { useAllowedTokens } from "@/hooks/useAllowedTokens";
import { ESCROW_ABI } from "@/lib/abis";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { friendlyError } from "@/lib/errors";
import { useRefresh } from "@/lib/refresh";
import { shortAddress } from "@/types/operation";

type TxState = "idle" | "pending" | "success" | "error";

export function AddToken() {
  const { account, signer } = useEthereum();
  const { data: owner } = useOwner();
  const { data: tokens, isLoading: tokensLoading, refetch } = useAllowedTokens();
  const { refresh } = useRefresh();

  const [tokenAddress, setTokenAddress] = useState("");
  const [status, setStatus] = useState<TxState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // 🇪🇸 GATE DE ROL (render-conditional): si no eres el owner, este panel NO existe para ti.
  //    No dejamos que la tx falle en cadena; simplemente no renderizamos nada.
  const isOwner =
    account !== null && owner !== null && account.toLowerCase() === owner.toLowerCase();
  if (!isOwner) return null;

  const handleAdd = async () => {
    setMessage(null);
    if (!isAddress(tokenAddress)) {
      setStatus("error");
      setMessage("Enter a valid token address.");
      return;
    }
    if (!signer) {
      setStatus("error");
      setMessage("Wallet not connected.");
      return;
    }
    try {
      setStatus("pending");
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.addToken(tokenAddress);
      await tx.wait();
      setStatus("success");
      setMessage("Token added to the allowlist.");
      setTokenAddress("");
      refetch();
      refresh();
    } catch (err) {
      setStatus("error");
      setMessage(friendlyError(err));
    }
  };

  return (
    <section className="rounded-lg border border-foreground/15 p-4">
      <h2 className="text-base font-semibold">Token Allowlist</h2>
      <p className="mt-1 text-xs opacity-60">
        Owner-only. Escrow:{" "}
        <span className="font-mono">{shortAddress(ESCROW_ADDRESS)}</span>
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
        className="mt-3 flex flex-col gap-2"
      >
        <input
          type="text"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          placeholder="0x… token address"
          className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-foreground/50"
        />
        <button
          type="submit"
          disabled={status === "pending"}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {status === "pending" ? "Adding…" : "Add token"}
        </button>
      </form>

      {message !== null && (
        <p
          className={`mt-2 text-xs ${status === "error" ? "text-red-500" : "opacity-70"}`}
        >
          {message}
        </p>
      )}

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide opacity-60">
          Allowed tokens
        </h3>
        {tokensLoading && tokens === null ? (
          <p className="mt-1 text-sm opacity-60">Loading…</p>
        ) : tokens && tokens.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-1">
            {tokens.map((token) => (
              <li key={token.address} className="flex items-center justify-between text-sm">
                <span className="font-medium">{token.symbol}</span>
                <span className="font-mono text-xs opacity-60">
                  {shortAddress(token.address)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm opacity-60">No tokens allowed yet.</p>
        )}
      </div>
    </section>
  );
}
