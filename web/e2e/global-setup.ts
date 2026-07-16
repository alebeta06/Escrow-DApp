import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { ENV_FILE, ARTIFACTS_DIR } from "./support/env";

// web/e2e -> web -> repo root
const WEB_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(__dirname, "..", "..");

const ANVIL_PORT = 8546;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;
const DEV_PORT = 3100;
const DEV_URL = `http://localhost:${DEV_PORT}`;

async function anvilReady(): Promise<boolean> {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    const json = (await res.json()) as { result?: string };
    return typeof json.result === "string";
  } catch {
    return false;
  }
}

async function httpOk(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).status === 200;
  } catch {
    return false;
  }
}

async function waitFor(check: () => Promise<boolean>, label: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(500);
  }
  throw new Error(`Timeout esperando ${label} (${timeoutMs}ms)`);
}

function readAddress(source: string, name: string): string {
  const match = source.match(new RegExp(`${name}\\s*=\\s*"(0x[0-9a-fA-F]{40})"`));
  if (!match) throw new Error(`No pude leer ${name} de contracts.ts`);
  return match[1];
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  // 1) Anvil fresco en :8546 (grupo propio para poder matarlo entero en teardown).
  const anvil = spawn("anvil", ["--port", String(ANVIL_PORT), "--silent"], {
    detached: true,
    stdio: "ignore",
  });
  anvil.unref();
  const anvilPid = anvil.pid;
  if (anvilPid === undefined) throw new Error("No se pudo arrancar anvil");

  try {
    await waitFor(anvilReady, `Anvil en ${RPC_URL}`, 20_000);

    // 2) Deploy contra ese Anvil (deploy.sh acepta RPC_URL por env; regenera web/lib/contracts.ts).
    execFileSync("bash", ["deploy.sh"], {
      cwd: REPO_ROOT,
      env: { ...process.env, RPC_URL },
      stdio: "inherit",
    });

    // 3) Leer direcciones desde el contracts.ts recién regenerado (no hardcodear).
    const contractsSrc = readFileSync(resolve(WEB_DIR, "lib", "contracts.ts"), "utf8");
    const escrow = readAddress(contractsSrc, "ESCROW_ADDRESS");
    const tka = readAddress(contractsSrc, "TKA_ADDRESS");
    const tkb = readAddress(contractsSrc, "TKB_ADDRESS");

    // 4) Servidor Next dev en :3100 (arrancado DESPUÉS del deploy → sirve contra el estado ya sembrado).
    //    🇪🇸 LOGS_RPC_URL apunta al Anvil del test (:8546); si no, la route /api/timeline defaultea a
    //    :8545 (el Anvil de desarrollo del usuario) y escanearía la cadena equivocada.
    const dev = spawn("pnpm", ["exec", "next", "dev", "-p", String(DEV_PORT)], {
      cwd: WEB_DIR,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, LOGS_RPC_URL: RPC_URL },
    });
    dev.unref();
    const devPid = dev.pid;
    if (devPid === undefined) throw new Error("No se pudo arrancar next dev");

    // Poll a "/" fuerza la compilación inicial de la página (dev compila lazy) → tests rápidos luego.
    await waitFor(() => httpOk(DEV_URL), `Next dev en ${DEV_URL}`, 120_000);

    writeFileSync(
      ENV_FILE,
      JSON.stringify({ rpcUrl: RPC_URL, escrow, tka, tkb, anvilPid, devPid }, null, 2),
    );
  } catch (err) {
    // Si algo falla tras arrancar Anvil, no lo dejamos colgando.
    try {
      process.kill(-anvilPid, "SIGTERM");
    } catch {
      /* ya muerto */
    }
    throw err;
  }
}
