import { test as base, expect, type Page } from "@playwright/test";
import { installWalletMock, type WalletMock } from "./mockWallet";
import { readEnv, type E2EEnv } from "./env";
import { addressOf, pkFor, shortOf, type Role } from "./accounts";

interface Fixtures {
  env: E2EEnv;
  wallet: WalletMock;
}

export const test = base.extend<Fixtures>({
  // 🇪🇸 env se lee LAZY dentro del fixture (tras global-setup), nunca en import del módulo.
  env: async ({}, use) => {
    await use(readEnv());
  },
  wallet: async ({ context, env }, use) => {
    const mock = await installWalletMock(context, env.rpcUrl);
    await use(mock);
  },
});

export { expect };

/**
 * Fija el actor, navega y espera a que la UI muestre su address (auto-reconexión silenciosa).
 * Modela el cambio de rol de wallet SIN popup: cambiar la clave del mock + reload.
 */
export async function connectAs(page: Page, wallet: WalletMock, role: Role): Promise<void> {
  wallet.setActor(role);
  await page.goto("/");
  // 🇪🇸 scope al header: la address abreviada aparece también en Operations/Balances/Timeline.
  await expect(page.locator("header").getByText(shortOf(pkFor(role)))).toBeVisible();
}

export { addressOf, pkFor, shortOf };
