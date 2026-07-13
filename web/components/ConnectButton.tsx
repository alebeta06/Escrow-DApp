"use client";

import { useEffect, useState } from "react";
import { useEthereum } from "@/lib/ethereum";
import { shortAddress } from "@/types/operation";

const BTN =
  "rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80 disabled:opacity-40";
const BTN_OUTLINE =
  "rounded-md border border-foreground/25 px-3 py-2 text-sm font-medium transition-opacity hover:opacity-70";

export function ConnectButton() {
  const { account, isConnected, hasMetaMask, connect, disconnect } = useEthereum();

  // 🇪🇸 patrón `mounted`: no renderizamos estado de wallet hasta montar en cliente, para que el
  //    HTML del servidor y el primer render del cliente coincidan (evita hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleConnect = async () => {
    try {
      await connect();
    } catch {
      // 🇪🇸 rechazo del popup u otro fallo: no hay nada que mostrar aquí, quedamos desconectados.
    }
  };

  if (!mounted) {
    return (
      <button className={BTN} disabled>
        …
      </button>
    );
  }

  if (!hasMetaMask) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className={BTN}
      >
        Install MetaMask
      </a>
    );
  }

  if (!isConnected || account === null) {
    return (
      <button className={BTN} onClick={handleConnect}>
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm">{shortAddress(account)}</span>
      <button className={BTN_OUTLINE} onClick={disconnect}>
        Disconnect
      </button>
    </div>
  );
}
