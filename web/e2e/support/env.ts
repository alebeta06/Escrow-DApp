import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Datos del entorno E2E, escritos por global-setup tras levantar Anvil + deploy. */
export interface E2EEnv {
  rpcUrl: string;
  escrow: string;
  tka: string;
  tkb: string;
  anvilPid: number;
  devPid: number;
}

export const ARTIFACTS_DIR = resolve(__dirname, "..", ".artifacts");
export const ENV_FILE = resolve(ARTIFACTS_DIR, "env.json");

/** Lee env.json. Llamar SOLO tras global-setup (p.ej. dentro de un fixture, no en import). */
export function readEnv(): E2EEnv {
  return JSON.parse(readFileSync(ENV_FILE, "utf8")) as E2EEnv;
}
