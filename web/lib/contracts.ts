// Direcciones de los contratos. VERSIONADO (a diferencia de antes, cuando lo generaba deploy.sh).
// Las direcciones llegan por variables de entorno `NEXT_PUBLIC_*` para que Vercel pueda construir
// desde git sin depender de un artefacto generado que estaba gitignored.
//
// 🇪🇸 NOTA: los defaults son las direcciones DETERMINISTAS de un deploy en Anvil (chainId 31337) —
//    account #0 despliega TKA→TKB→Escrow en orden fijo, así que salen siempre iguales (verificado en
//    Anvil fresco: Escrow es la 3ª tx CREATE → DEPLOY_BLOCK=3). Por eso el flujo local
//    (anvil → ./deploy.sh → pnpm dev) funciona SIN configurar env vars: `deploy.sh` escribe
//    web/.env.development.local (lo carga `next dev` con prioridad sobre .env.local) y, aunque no
//    existiera, estos defaults ya coinciden. En Sepolia/Vercel las env vars se configuran en el
//    dashboard y sobreescriben los defaults.

// 🇪🇸 Trata "" como ausente: si Vercel setea una var vacía, caemos al default en vez de romper.
const envOr = (value: string | undefined, fallback: string): string =>
  value && value.length > 0 ? value : fallback;

export const CHAIN_ID = Number(envOr(process.env.NEXT_PUBLIC_CHAIN_ID, "31337"));

export const ESCROW_ADDRESS = envOr(
  process.env.NEXT_PUBLIC_ESCROW_ADDRESS,
  "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
);
export const TKA_ADDRESS = envOr(
  process.env.NEXT_PUBLIC_TKA_ADDRESS,
  "0x5fbdb2315678afecb367f032d93f642f64180aa3",
);
export const TKB_ADDRESS = envOr(
  process.env.NEXT_PUBLIC_TKB_ADDRESS,
  "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
);

// 🇪🇸 Bloque del deploy del Escrow: el indexer de eventos escanea DESDE aquí (nunca desde 0).
export const DEPLOY_BLOCK = Number(envOr(process.env.NEXT_PUBLIC_DEPLOY_BLOCK, "3"));

export const CONTRACTS = {
  chainId: CHAIN_ID,
  escrow: ESCROW_ADDRESS,
  tka: TKA_ADDRESS,
  tkb: TKB_ADDRESS,
  deployBlock: DEPLOY_BLOCK,
} as const;
