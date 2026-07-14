import { readFileSync } from "node:fs";
import { ENV_FILE } from "./support/env";

/** Mata el server dev y Anvil (por grupo de proceso; fallback a pid suelto). */
export default async function globalTeardown(): Promise<void> {
  let env: { anvilPid?: number; devPid?: number };
  try {
    env = JSON.parse(readFileSync(ENV_FILE, "utf8"));
  } catch {
    return; // sin env.json no hay nada que matar
  }
  for (const pid of [env.devPid, env.anvilPid]) {
    if (pid === undefined) continue;
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      /* grupo ya muerto */
    }
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* pid ya muerto */
    }
  }
}
