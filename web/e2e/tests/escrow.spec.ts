import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Contract, ContractFactory, JsonRpcProvider, Wallet, parseUnits } from "ethers";
import { test, expect, connectAs, addressOf, shortOf } from "../support/fixtures";
import { ALICE_PK, BOB_PK } from "../support/accounts";
import { ESCROW_ABI, ERC20_ABI } from "../../lib/abis";
import type { E2EEnv } from "../support/env";

// 🇪🇸 LIMITACIÓN CONOCIDA (aceptada): el cambio de rol de wallet se hace cambiando la clave del mock
//    + `page.reload()`, que reconecta vía la auto-reconexión (`eth_accounts`). NO se emite el evento
//    `accountsChanged`, así que ese listener del provider queda sin cubrir por los tests. Se verificó
//    a mano; emitir el evento desde el mock introducía flakiness. Ver CLAUDE.md (sección testing).

const ALICE = addressOf(ALICE_PK);
const BOB = addressOf(BOB_PK);
const E18 = (n: string) => parseUnits(n, 18);

function ro(env: E2EEnv): JsonRpcProvider {
  return new JsonRpcProvider(env.rpcUrl);
}
async function tokenBalance(env: E2EEnv, token: string, account: string): Promise<bigint> {
  return (await new Contract(token, ERC20_ABI, ro(env)).balanceOf(account)) as bigint;
}
async function isAllowed(env: E2EEnv, token: string): Promise<boolean> {
  return (await new Contract(env.escrow, ESCROW_ABI, ro(env)).isTokenAllowed(token)) as boolean;
}

// Localiza la tarjeta de una operación por su id ("#0", "#1", …) DENTRO de la sección Operations.
// 🇪🇸 Se scopea a esa sección a propósito: el Timeline ("Activity") también renderiza <li> con "#id",
//    así que un `page.locator("li")` global ya no sería único.
const opCard = (page: import("@playwright/test").Page, id: number) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Operations", exact: true }) })
    .locator("li")
    .filter({ hasText: `#${id}` });

async function fillCreateForm(page: import("@playwright/test").Page): Promise<void> {
  await page.getByLabel("Token A (offer)").selectOption({ label: "TKA" });
  await page.getByLabel("Token B (request)").selectOption({ label: "TKB" });
  await page.getByLabel("Amount A").fill("100");
  await page.getByLabel("Amount B").fill("150");
  await page.getByRole("button", { name: "Create operation" }).click();
}

// 🇪🇸 serial: comparten el estado on-chain del MISMO Anvil (create→complete→cancel encadenan ids).
test.describe.serial("Escrow dApp — E2E flows", () => {
  test("connect: shows Alice's address after clicking Connect", async ({ page, wallet }) => {
    void wallet; // instala el mock (sin permiso previo → arranca desconectado)
    await page.goto("/");
    await expect(page.getByText("Welcome")).toBeVisible();

    await page.getByRole("button", { name: "Connect Wallet" }).click();
    // 🇪🇸 scope al header: la address abreviada ahora aparece también en Operations/Balances/Timeline.
    await expect(page.locator("header").getByText(shortOf(ALICE_PK))).toBeVisible();
  });

  test("role gate: AddToken visible for owner, hidden for non-owner", async ({ page, wallet }) => {
    await connectAs(page, wallet, "alice");
    await expect(page.getByRole("heading", { name: "Token Allowlist" })).toBeVisible();

    wallet.setActor("bob");
    await page.reload();
    await expect(page.locator("header").getByText(shortOf(BOB_PK))).toBeVisible(); // reconectado como Bob
    await expect(page.getByRole("heading", { name: "Token Allowlist" })).toHaveCount(0);
  });

  test("addToken: owner adds a freshly deployed token", async ({ page, wallet, env }) => {
    // Despliega un TestToken "TKC" en Node (un address random rompería la UI al leer symbol()).
    const artifactPath = resolve(__dirname, "../../../out/TestToken.sol/TestToken.json");
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    const factory = new ContractFactory(
      artifact.abi,
      artifact.bytecode.object,
      new Wallet(ALICE_PK, ro(env)),
    );
    const tkc = await factory.deploy("Token C", "TKC");
    await tkc.waitForDeployment();
    const tkcAddr = await tkc.getAddress();

    await connectAs(page, wallet, "alice");
    await page.getByPlaceholder("0x… token address").fill(tkcAddr);
    await page.getByRole("button", { name: "Add token" }).click();

    const addTokenSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Token Allowlist" }) });
    await expect(addTokenSection.getByText("TKC")).toBeVisible();
    expect(await isAllowed(env, tkcAddr)).toBe(true);
  });

  test("createOperation: 2-step approve+create locks tokenA in escrow", async ({
    page,
    wallet,
    env,
  }) => {
    await connectAs(page, wallet, "alice");
    const escrowTkaBefore = await tokenBalance(env, env.tka, env.escrow);

    await fillCreateForm(page);

    // Esperar el estado DOM terminal (op #0 Active) ANTES de leer on-chain → tx ya minada.
    await expect(opCard(page, 0)).toContainText("Active");
    const escrowTkaAfter = await tokenBalance(env, env.tka, env.escrow);
    expect(escrowTkaAfter - escrowTkaBefore).toBe(E18("100"));
  });

  test("completeOperation: counterparty completes; atomic swap settles", async ({
    page,
    wallet,
    env,
  }) => {
    const escrowTkaBefore = await tokenBalance(env, env.tka, env.escrow);
    const bobTkaBefore = await tokenBalance(env, env.tka, BOB);
    const aliceTkbBefore = await tokenBalance(env, env.tkb, ALICE);

    await connectAs(page, wallet, "bob");
    const op0 = opCard(page, 0);
    // Rol contraparte: ve Complete, NO Cancel.
    await expect(op0.getByRole("button", { name: "Complete Operation" })).toBeVisible();
    await expect(op0.getByRole("button", { name: "Cancel Operation" })).toHaveCount(0);

    await op0.getByRole("button", { name: "Complete Operation" }).click();
    await expect(op0).toContainText("Completed");

    expect(await tokenBalance(env, env.tka, env.escrow)).toBe(escrowTkaBefore - E18("100"));
    expect(await tokenBalance(env, env.tka, BOB)).toBe(bobTkaBefore + E18("100"));
    expect(await tokenBalance(env, env.tkb, ALICE)).toBe(aliceTkbBefore + E18("150"));
  });

  test("cancelOperation: creator cancels; tokenA is refunded", async ({ page, wallet, env }) => {
    await connectAs(page, wallet, "alice");
    const aliceTkaBefore = await tokenBalance(env, env.tka, ALICE);

    await fillCreateForm(page); // op #1
    await expect(opCard(page, 1)).toContainText("Active");

    await opCard(page, 1).getByRole("button", { name: "Cancel Operation" }).click();
    await expect(opCard(page, 1)).toContainText("Cancelled");

    // create bloqueó 100 TKA y cancel los devolvió → balance vuelve al de antes de crear.
    expect(await tokenBalance(env, env.tka, ALICE)).toBe(aliceTkaBefore);
  });
});
