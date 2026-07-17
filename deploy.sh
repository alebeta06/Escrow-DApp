#!/usr/bin/env bash
#
# deploy.sh — Despliegue LOCAL del Escrow en Anvil.
#
# Asume que Anvil YA está corriendo en $RPC_URL (default http://localhost:8545; override por env
# RPC_URL para apuntar a otro puerto, p.ej. el Anvil efímero de los tests E2E). No lo arranca.
# Despliega TKA/TKB + Escrow, autoriza los tokens, siembra balances, y exporta las
# direcciones a web/lib/contracts.ts + deployment-info.txt.
#
# Solo LOCAL — NO Sepolia, NO verificación (eso es Fase 2).

set -euo pipefail

# 🇪🇸 RPC configurable por env: default 8545 (uso manual intacto); los tests E2E lo sobreescriben
#    para apuntar a su Anvil efímero. El chainId sigue siendo 31337 en cualquier puerto de Anvil.
RPC_URL="${RPC_URL:-http://localhost:8545}"
# 🇪🇸 Anvil Account #0 — clave PÚBLICA y estándar de test de Anvil. NO es un secreto y solo
#    sirve para deploy LOCAL. El flujo Sepolia usa el keystore cifrado 'alebeta-admin', nunca esto.
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
OWNER="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"  # Anvil Account #0 = owner del Escrow
RUN_LATEST="broadcast/Deploy.s.sol/31337/run-latest.json"

# 1-2: comprobar que Anvil responde.
echo "==> Comprobando que Anvil responde en $RPC_URL ..."
if ! curl -s -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    --max-time 3 | grep -q '"result"'; then
  echo "ERROR: Anvil no responde en $RPC_URL." >&2
  echo "       Arranca Anvil primero (en otra terminal: 'anvil') y reintenta." >&2
  exit 1
fi

# 3: desplegar.
#    🇪🇸 --slow: envía las tx de una en una esperando el receipt de cada una antes de mandar la
#       siguiente. Elimina POR CONSTRUCCIÓN los huecos de nonce que colgaban el broadcast (tx
#       encolada + forge esperando un receipt que nunca llega). En Anvil instamine el coste es
#       despreciable (~11 tx) y a cambio el deploy es determinista.
echo "==> Desplegando en Anvil local ..."
forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast --slow

# 4: parsear las 3 direcciones desde run-latest.json (más robusto que stdout).
#    🇪🇸 Hay DOS TestToken con el mismo contractName → se distinguen por el símbolo del
#       constructor ("TKA"/"TKB") en los arguments, no por orden.
echo "==> Parseando direcciones desde $RUN_LATEST ..."
ADDRS="$(python3 - "$RUN_LATEST" <<'PY'
import json, sys

data = json.load(open(sys.argv[1]))
escrow = tka = tkb = ""
for tx in data.get("transactions", []):
    if tx.get("transactionType") != "CREATE":
        continue
    name = tx.get("contractName")
    addr = tx.get("contractAddress")
    args = json.dumps(tx.get("arguments") or [])
    if name == "Escrow":
        escrow = addr
    elif name == "TestToken":
        if "TKA" in args:
            tka = addr
        elif "TKB" in args:
            tkb = addr

if not (escrow and tka and tkb):
    sys.stderr.write("ERROR: no se pudieron extraer las 3 direcciones del run-latest.json\n")
    sys.exit(1)

# 🇪🇸 El bloque del deploy vive en RECEIPTS (hex), NO en transactions (ahí es null). Buscamos el
#    receipt cuya contractAddress es la del Escrow → su blockNumber es el DEPLOY_BLOCK. Desde ahí
#    escanea el indexer (nunca desde 0: la lección que costó caro en M8).
deploy_block = None
for r in data.get("receipts", []):
    addr = (r.get("contractAddress") or "").lower()
    if addr == escrow.lower():
        deploy_block = int(r["blockNumber"], 16)
        break

if deploy_block is None:
    sys.stderr.write("ERROR: no se pudo extraer el blockNumber del deploy del Escrow (receipts)\n")
    sys.exit(1)

print(escrow)
print(tka)
print(tkb)
print(deploy_block)
PY
)"

mapfile -t LINES <<< "$ADDRS"
ESCROW_ADDRESS="${LINES[0]}"
TKA_ADDRESS="${LINES[1]}"
TKB_ADDRESS="${LINES[2]}"
DEPLOY_BLOCK="${LINES[3]}"

# 5: generar web/.env.development.local (idempotente: se regenera entero en cada deploy).
#    🇪🇸 web/lib/contracts.ts ahora está VERSIONADO y lee las direcciones de env vars NEXT_PUBLIC_*
#       (con defaults de Anvil). Aquí solo alimentamos esas vars para el flujo local: Next.js carga
#       .env.development.local en `next dev` con PRIORIDAD sobre .env.local, así que NO tocamos
#       .env.local (donde vive el PINATA_JWT). En Sepolia/Vercel las vars se configuran en el dashboard.
echo "==> Generando web/.env.development.local ..."
mkdir -p web
cat > web/.env.development.local <<EOF
# AUTO-GENERADO por deploy.sh — NO editar a mano (se regenera en cada deploy local).
# 🇪🇸 Direcciones del deploy en Anvil. Lo carga `next dev` (development) con prioridad sobre .env.local.
NEXT_PUBLIC_ESCROW_ADDRESS=${ESCROW_ADDRESS}
NEXT_PUBLIC_TKA_ADDRESS=${TKA_ADDRESS}
NEXT_PUBLIC_TKB_ADDRESS=${TKB_ADDRESS}
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_DEPLOY_BLOCK=${DEPLOY_BLOCK}
EOF

# 6: generar deployment-info.txt (artefacto local legible).
echo "==> Generando deployment-info.txt ..."
cat > deployment-info.txt <<EOF
Escrow DApp — Despliegue LOCAL
==============================
Fecha:   $(date -u '+%Y-%m-%d %H:%M:%S UTC')
Red:     Anvil (chainId 31337) @ $RPC_URL
Owner:   $OWNER  (Anvil Account #0)

Contratos:
  ESCROW: $ESCROW_ADDRESS
  TKA:    $TKA_ADDRESS
  TKB:    $TKB_ADDRESS

Deploy block (Escrow): $DEPLOY_BLOCK

Tokens autorizados en el Escrow: TKA, TKB
Seed: 1000e18 de cada token a las cuentas Anvil #0, #1, #2
EOF

# 7: mensaje final.
echo ""
echo "==> Despliegue local completado."
echo "    ESCROW: $ESCROW_ADDRESS"
echo "    TKA:    $TKA_ADDRESS"
echo "    TKB:    $TKB_ADDRESS"
echo "    Direcciones exportadas a web/.env.development.local (CHAIN_ID=31337)."
echo "    Listo. Arranca el frontend con: cd web && pnpm dev"
