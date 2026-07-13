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

## Testing (prompts posteriores)
- 100% coverage (líneas, statements, branches, funcs) con ASERCIONES REALES, no ejecución hueca
- `vm.startPrank` / `vm.stopPrank` (nunca `vm.prank` suelto)
- Harness pattern para probar funciones `internal` de las librerías

## Git / Workflow
- Conventional Commits en INGLÉS: `type(scope): subject`
- Commits atómicos por unidad lógica (NO mega-commits)
- NO Co-Authored-By trailers
- NO auto-push (yo hago push manual desde mi terminal)
- Modo plan / manual-approve: propón antes de escribir; PÁUSATE al primer fallo para diagnosticar, no lo tapes
