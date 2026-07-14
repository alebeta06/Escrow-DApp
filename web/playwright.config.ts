import { defineConfig, devices } from "@playwright/test";

// 🇪🇸 Anvil efímero + deploy + next dev los gestiona global-setup/teardown (ordering bulletproof).
//    Un solo Anvil con estado mutable compartido → workers:1 + sin paralelismo; el ciclo de vida
//    (create→complete→cancel) va en describe.serial dentro del spec.
export default defineConfig({
  testDir: "./e2e/tests",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
