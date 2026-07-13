// ABIs del frontend para el Escrow DApp.
//
// 🇪🇸 NOTA: ¿por qué los ABIs viven aquí (versionado) y las direcciones en `contracts.ts`
//    (efímero, gitignored)? Los ABIs solo cambian si cambia el contrato → estables, se commitean.
//    Las direcciones cambian en CADA deploy local y `deploy.sh` regenera `contracts.ts` entero.
//    Separarlos evita que ese re-deploy pise los ABIs.
//
// Fuente de verdad: out/Escrow.sol/Escrow.json (artefacto compilado por Foundry). Aquí se incluye
// SOLO el subconjunto que usa el frontend. `as const` habilita la inferencia de tipos de ethers v6.
//
// 🇪🇸 NOTA: el struct `Operation` se declara con sus `components` en cada view que lo devuelve, para
//    que ethers decodifique los campos por nombre (op.creator, op.amountA, op.status, …).

/**
 * Reusable tuple definition for the on-chain `Operation` struct.
 * `status` is a `uint8` mirroring the `OperationStatus` enum (0 = Active, 1 = Completed, 2 = Cancelled).
 */
const OPERATION_COMPONENTS = [
  { name: "id", type: "uint256" },
  { name: "creator", type: "address" },
  { name: "counterparty", type: "address" },
  { name: "tokenA", type: "address" },
  { name: "tokenB", type: "address" },
  { name: "amountA", type: "uint256" },
  { name: "amountB", type: "uint256" },
  { name: "status", type: "uint8" },
  { name: "memoCID", type: "string" },
] as const;

/**
 * Curated ABI for the `Escrow` contract: the 4 write functions, the 8 views plus `owner()`,
 * and the 4 domain events the UI listens to.
 */
export const ESCROW_ABI = [
  // ── Writes ─────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "addToken",
    stateMutability: "nonpayable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "createOperation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
      { name: "memoCID", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "completeOperation",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelOperation",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },

  // ── Views ──────────────────────────────────────────────────────────────────
  {
    type: "function",
    name: "getAllowedTokens",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getAllOperations",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "all", type: "tuple[]", components: OPERATION_COMPONENTS }],
  },
  {
    type: "function",
    name: "getOperation",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "tuple", components: OPERATION_COMPONENTS }],
  },
  {
    type: "function",
    name: "getOperationsByCreator",
    stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "result", type: "tuple[]", components: OPERATION_COMPONENTS }],
  },
  {
    type: "function",
    name: "getActiveOperations",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "result", type: "tuple[]", components: OPERATION_COMPONENTS }],
  },
  {
    type: "function",
    name: "isTokenAllowed",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getOperationCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getTokenCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  {
    type: "event",
    name: "TokenAdded",
    inputs: [{ name: "token", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "OperationCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "tokenA", type: "address", indexed: false },
      { name: "tokenB", type: "address", indexed: false },
      { name: "amountA", type: "uint256", indexed: false },
      { name: "amountB", type: "uint256", indexed: false },
      { name: "memoCID", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OperationCompleted",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "counterparty", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "OperationCancelled",
    inputs: [{ name: "id", type: "uint256", indexed: true }],
  },
] as const;

/**
 * Minimal ERC20 ABI: enough to read balances/metadata and run the `approve` step required
 * before `createOperation` / `completeOperation` can pull the caller's tokens.
 */
export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
