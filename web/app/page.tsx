"use client";

import { useEthereum } from "@/lib/ethereum";
import { RefreshProvider } from "@/lib/refresh";
import { CHAIN_ID } from "@/lib/contracts";
import { ConnectButton } from "@/components/ConnectButton";
import { AddToken } from "@/components/AddToken";
import { CreateOperation } from "@/components/CreateOperation";
import { OperationsList } from "@/components/OperationsList";
import { Balances } from "@/components/Balances";
import { Timeline } from "@/components/Timeline";

export default function Home() {
  const { isConnected } = useEthereum();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-foreground/10 px-6 py-4">
        <h1 className="text-lg font-semibold">Escrow DApp</h1>
        <ConnectButton />
      </header>

      <main className="flex-1 px-6 py-8">
        {!isConnected ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <h2 className="text-xl font-semibold">Welcome</h2>
            <p className="mt-2 text-sm opacity-70">
              Connect your wallet to create and settle atomic ERC20 swaps on the local Anvil
              network.
            </p>
          </div>
        ) : (
          // 🇪🇸 RefreshProvider SOLO alrededor del grid conectado: coordina el refetch entre
          //    columnas (crear/completar/cancelar refresca operaciones y balances).
          <RefreshProvider>
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Col 1: acciones. AddToken se auto-oculta si no eres el owner. */}
                <div className="flex flex-col gap-6">
                  <AddToken />
                  <CreateOperation />
                </div>
                {/* Col 2: operaciones con acciones por rol. */}
                <OperationsList />
                {/* Col 3: balances. */}
                <Balances />
              </div>
              {/* Fila full-width: timeline de actividad alimentado por el indexer. */}
              <Timeline />
            </div>
          </RefreshProvider>
        )}
      </main>

      <footer className="border-t border-foreground/10 px-6 py-4 text-xs opacity-60">
        Escrow DApp — CodeCrypto M9 · Local Anvil (chainId {CHAIN_ID})
      </footer>
    </div>
  );
}
