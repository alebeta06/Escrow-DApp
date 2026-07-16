import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider, type Log, type LogDescription } from "ethers";
import { ESCROW_ABI } from "@/lib/abis";
import { DEPLOY_BLOCK, ESCROW_ADDRESS } from "@/lib/contracts";

// 🇪🇸 Indexer server-side: escanea los eventos del Escrow y les añade el timestamp del bloque, algo
//    que getAllOperations() NO da (el getter es estado actual, no historia con tiempos). La URL del
//    RPC es server-side (sin NEXT_PUBLIC_): no se expone al navegador.

export const dynamic = "force-dynamic";

const LOGS_RPC_URL = process.env.LOGS_RPC_URL || "http://localhost:8545";
const WINDOW_SIZE = Math.max(1, Number(process.env.LOG_WINDOW_SIZE || "50000"));
const CACHE_TTL_MS = 8000;

type TimelineType =
  | "TokenAdded"
  | "OperationCreated"
  | "OperationCompleted"
  | "OperationCancelled";

interface TimelineEntry {
  type: TimelineType;
  blockNumber: number;
  logIndex: number;
  timestamp: number; // unix seconds (del bloque)
  txHash: string;
  actor: string | null; // dirección relevante del evento
  operationId: string | null;
  token?: string;
  tokenA?: string;
  tokenB?: string;
  amountA?: string;
  amountB?: string;
  memoCID?: string;
  counterparty?: string;
}

// 🇪🇸 Caché en memoria (module-scope): en serverless MUERE en cada cold start. Aceptable para este
//    alcance (nada de Redis/DB). TTL corto para no re-escanear en cada request.
let cache: { at: number; entries: TimelineEntry[] } | null = null;

async function scanTimeline(): Promise<TimelineEntry[]> {
  // 🇪🇸 batchMaxCount:1 — ethers v6 agrupa llamadas (100) por defecto y algunos RPC free tier
  //    rechazan batches grandes. Forzar 1. Lección de M8, aplicada preventivamente para Sepolia.
  const provider = new JsonRpcProvider(LOGS_RPC_URL, undefined, { batchMaxCount: 1 });
  const iface = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider).interface;

  const latest = await provider.getBlockNumber();

  // Escaneo paginado en ventanas DESDE el deployBlock (nunca desde 0).
  const logs: Log[] = [];
  for (let from = DEPLOY_BLOCK; from <= latest; from += WINDOW_SIZE) {
    const to = Math.min(from + WINDOW_SIZE - 1, latest);
    const chunk = await provider.getLogs({ address: ESCROW_ADDRESS, fromBlock: from, toBlock: to });
    logs.push(...chunk);
  }

  // Parsear con la interfaz: los logs que no son de la ABI → null y se descartan.
  const parsed: { log: Log; desc: LogDescription }[] = [];
  for (const log of logs) {
    const desc = iface.parseLog({ topics: Array.from(log.topics), data: log.data });
    if (desc) parsed.push({ log, desc });
  }

  // Timestamps: DEDUPLICAR blockNumber (varios eventos comparten bloque) y resolver en paralelo.
  const uniqueBlocks = [...new Set(parsed.map((p) => p.log.blockNumber))];
  const blockTs = new Map<number, number>();
  await Promise.all(
    uniqueBlocks.map(async (bn) => {
      const block = await provider.getBlock(bn);
      if (block) blockTs.set(bn, block.timestamp);
    }),
  );

  // Correlación operationId → creator: los eventos Completed/Cancelled no traen la dirección del
  // creador; la recuperamos de su OperationCreated para poder mostrar el actor.
  const creatorById = new Map<string, string>();
  for (const { desc } of parsed) {
    if (desc.name === "OperationCreated") {
      creatorById.set(String(desc.args.id), String(desc.args.creator));
    }
  }

  const entries: TimelineEntry[] = parsed.map(({ log, desc }): TimelineEntry => {
    const base = {
      type: desc.name as TimelineType,
      blockNumber: log.blockNumber,
      logIndex: log.index,
      timestamp: blockTs.get(log.blockNumber) ?? 0,
      txHash: log.transactionHash,
      actor: null as string | null,
      operationId: null as string | null,
    };
    switch (desc.name) {
      case "TokenAdded":
        return { ...base, token: String(desc.args.token) };
      case "OperationCreated":
        return {
          ...base,
          operationId: String(desc.args.id),
          actor: String(desc.args.creator),
          tokenA: String(desc.args.tokenA),
          tokenB: String(desc.args.tokenB),
          amountA: (desc.args.amountA as bigint).toString(),
          amountB: (desc.args.amountB as bigint).toString(),
          memoCID: String(desc.args.memoCID),
        };
      case "OperationCompleted":
        return {
          ...base,
          operationId: String(desc.args.id),
          actor: String(desc.args.counterparty),
          counterparty: String(desc.args.counterparty),
        };
      case "OperationCancelled": {
        const id = String(desc.args.id);
        return { ...base, operationId: id, actor: creatorById.get(id) ?? null };
      }
      default:
        return base;
    }
  });

  // Orden cronológico NEWEST-FIRST (desc por bloque y, dentro del bloque, por logIndex).
  entries.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
  return entries;
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ entries: cache.entries });
  }
  try {
    const entries = await scanTimeline();
    cache = { at: Date.now(), entries };
    return NextResponse.json({ entries });
  } catch (err) {
    // 🇪🇸 log detallado solo en servidor; al cliente, error genérico. La app NO se cae por esto.
    console.error("Timeline indexer error:", err);
    return NextResponse.json({ error: "Failed to index events." }, { status: 502 });
  }
}
