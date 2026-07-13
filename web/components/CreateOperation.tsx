"use client";

import { useState } from "react";
import { Contract, parseUnits } from "ethers";
import { useEthereum } from "@/lib/ethereum";
import { useAllowedTokens, type AllowedToken } from "@/hooks/useAllowedTokens";
import { ERC20_ABI, ESCROW_ABI } from "@/lib/abis";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { friendlyError } from "@/lib/errors";
import { useRefresh } from "@/lib/refresh";

type Phase = "idle" | "approving" | "creating" | "success" | "error";

const INPUT =
  "rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50";

export function CreateOperation() {
  const { signer } = useEthereum();
  const { data: tokens } = useAllowedTokens();
  const { refresh } = useRefresh();

  const [tokenA, setTokenA] = useState("");
  const [tokenB, setTokenB] = useState("");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  // 🇪🇸 NOTA: el memo es funcional en la UI pero su valor se IGNORA — createOperation recibe
  //    memoCID = "" SIEMPRE hasta que se integre la subida real a IPFS/Pinata (prompt posterior).
  const [memo, setMemo] = useState("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const busy = phase === "approving" || phase === "creating";
  const list: AllowedToken[] = tokens ?? [];

  const findDecimals = (address: string): number =>
    list.find((t) => t.address === address)?.decimals ?? 18;

  const handleCreate = async () => {
    setMessage(null);

    // Validaciones client-side (feedback antes del revert on-chain).
    if (tokenA === "" || tokenB === "") {
      setPhase("error");
      setMessage("Select both tokens.");
      return;
    }
    if (tokenA === tokenB) {
      setPhase("error");
      setMessage("Token A and Token B must be different.");
      return;
    }
    if (!signer) {
      setPhase("error");
      setMessage("Wallet not connected.");
      return;
    }

    let amountAWei: bigint;
    let amountBWei: bigint;
    try {
      amountAWei = parseUnits(amountA || "0", findDecimals(tokenA));
      amountBWei = parseUnits(amountB || "0", findDecimals(tokenB));
    } catch {
      setPhase("error");
      setMessage("Enter valid numeric amounts.");
      return;
    }
    if (amountAWei <= BigInt(0) || amountBWei <= BigInt(0)) {
      setPhase("error");
      setMessage("Amounts must be greater than zero.");
      return;
    }

    try {
      // Paso 1: approve del tokenA que el creador bloquea.
      setPhase("approving");
      const erc20 = new Contract(tokenA, ERC20_ABI, signer);
      const approveTx = await erc20.approve(ESCROW_ADDRESS, amountAWei);
      await approveTx.wait();

      // Paso 2: crear la operación (memoCID = "" — ver NOTA arriba).
      setPhase("creating");
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const createTx = await escrow.createOperation(tokenA, tokenB, amountAWei, amountBWei, "");
      await createTx.wait();

      setPhase("success");
      setMessage("Operation created.");
      setAmountA("");
      setAmountB("");
      setMemo("");
      refresh();
    } catch (err) {
      setPhase("error");
      setMessage(friendlyError(err));
    }
  };

  const buttonLabel =
    phase === "approving" ? "Approving…" : phase === "creating" ? "Creating…" : "Create operation";

  return (
    <section className="rounded-lg border border-foreground/15 p-4">
      <h2 className="text-base font-semibold">Create Operation</h2>
      <p className="mt-1 text-xs opacity-60">
        Offer some Token A, request Token B. Tokens are locked until completed or cancelled.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleCreate();
        }}
        className="mt-3 flex flex-col gap-3"
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs opacity-70">
            Token A (offer)
            <select
              value={tokenA}
              onChange={(e) => setTokenA(e.target.value)}
              className={INPUT}
            >
              <option value="">Select…</option>
              {list.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs opacity-70">
            Token B (request)
            <select
              value={tokenB}
              onChange={(e) => setTokenB(e.target.value)}
              className={INPUT}
            >
              <option value="">Select…</option>
              {list.map((t) => (
                <option key={t.address} value={t.address}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs opacity-70">
            Amount A
            <input
              type="text"
              inputMode="decimal"
              value={amountA}
              onChange={(e) => setAmountA(e.target.value)}
              placeholder="0.0"
              className={INPUT}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs opacity-70">
            Amount B
            <input
              type="text"
              inputMode="decimal"
              value={amountB}
              onChange={(e) => setAmountB(e.target.value)}
              placeholder="0.0"
              className={INPUT}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs opacity-70">
          Memo / terms (optional, not stored yet)
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="Ignored until IPFS integration"
            className={INPUT}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {buttonLabel}
        </button>
      </form>

      {message !== null && (
        <p className={`mt-2 text-xs ${phase === "error" ? "text-red-500" : "opacity-70"}`}>
          {message}
        </p>
      )}
    </section>
  );
}
