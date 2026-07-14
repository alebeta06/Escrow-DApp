# CLAUDE.md — Escrow DApp (CodeCrypto M9)

## Stack
- Solidity 0.8.28 · Foundry (Forge/Anvil/Cast) · OpenZeppelin v5
- Frontend (más adelante): Next.js 15 App Router, TypeScript strict, Tailwind v4 (oklch), ethers.js v6

## Solidity
- Custom errors con args estratégicos (nunca `require` con strings)
- NatSpec en INGLÉS en todas las funciones public/external y en las librerías
- Comentarios pedagógicos en ESPAÑOL con prefijo `🇪🇸 NOTA:` en los puntos clave
- Patrón de librerías con `using for`: las libs hacen EFFECTS (mutación de estado); el contrato principal hace CHECKS + INTERACTIONS. Orden estricto checks-effects-interactions.
- ReentrancyGuard en toda función que haga transferencias externas
- Ejecutar `forge fmt` (desde la raíz Foundry) antes de CADA commit que toque ficheros `.sol`, para que el paso `forge fmt --check` del CI no falle. Esto es SOLO para Solidity; el frontend en `web/` se formatea con Prettier/ESLint, nunca con `forge fmt`.

## Testing

### Solidity (Foundry)
- 100% coverage (líneas, statements, branches, funcs) con ASERCIONES REALES, no ejecución hueca
- `vm.startPrank` / `vm.stopPrank` (nunca `vm.prank` suelto)
- Harness pattern para probar funciones `internal` de las librerías

### Frontend E2E (Playwright, en `web/`)
- Correr con `pnpm test:e2e` (desde `web/`). Ejercita los flujos reales (connect, role gate, addToken, create/complete/cancel) firmando tx REALES.
- **`window.ethereum` mockeado** (NO Synpress/MetaMask): provider EIP-1193 real respaldado por una ethers `Wallet` con claves de test de Anvil, inyectado con `addInitScript` (por eso `ethereum.tsx` lee `window.ethereum` lazy). Es un proxy JSON-RPC passthrough a Anvil; solo intercepta accounts + firma (`eth_sendTransaction`). La firma vive en Node vía `page.exposeFunction`. Usa un `NonceManager` por cuenta (sends consecutivos approve→create colisionaban por el cache de nonce ~250ms de ethers).
- **Anvil FRESCO por corrida**: `global-setup` levanta `anvil --port 8546`, corre `./deploy.sh` (con `RPC_URL` por env), arranca `next dev -p 3100` y escribe direcciones a `e2e/.artifacts/env.json`; `global-teardown` mata ambos. `workers:1` + `describe.serial` (un Anvil con estado compartido). Direcciones LEÍDAS, no hardcodeadas.
- **Cambio de rol** = cambiar la PK del mock + `page.reload()` (auto-reconexión sin popup). **Limitación conocida y aceptada**: no se emite `accountsChanged`, así que ese listener queda sin cubrir (emitirlo daba flakiness; verificado a mano).
- Determinismo: esperar el estado DOM terminal (op Active/Completed/Cancelled) ANTES de leer on-chain; NUNCA tapar carreras con `sleep`. `web/lib/contracts.ts` lo regenera el deploy del test y sigue gitignored.

## Git / Workflow
- Conventional Commits en INGLÉS: `type(scope): subject`
- Commits atómicos por unidad lógica (NO mega-commits)
- NO Co-Authored-By trailers
- NO auto-push (yo hago push manual desde mi terminal)
- Modo plan / manual-approve: propón antes de escribir; PÁUSATE al primer fallo para diagnosticar, no lo tapes
