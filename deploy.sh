#!/usr/bin/env bash
#
# deploy.sh — Despliegue LOCAL del Escrow en Anvil.
#
# Asume que Anvil YA está corriendo en http://localhost:8545 (no lo arranca).
# Despliega TKA/TKB + Escrow, autoriza los tokens, siembra balances, y exporta las
# direcciones a web/lib/contracts.ts + deployment-info.txt.
#
# Solo LOCAL — NO Sepolia, NO verificación (eso es Fase 2).

set -euo pipefail

RPC_URL="http://localhost:8545"
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
echo "==> Desplegando en Anvil local ..."
forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --broadcast

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

print(escrow)
print(tka)
print(tkb)
PY
)"

mapfile -t LINES <<< "$ADDRS"
ESCROW_ADDRESS="${LINES[0]}"
TKA_ADDRESS="${LINES[1]}"
TKB_ADDRESS="${LINES[2]}"

# 5: generar web/lib/contracts.ts (idempotente: se regenera entero en cada deploy).
echo "==> Generando web/lib/contracts.ts ..."
mkdir -p web/lib
cat > web/lib/contracts.ts <<EOF
// AUTO-GENERADO por deploy.sh — NO editar a mano.
// 🇪🇸 Se regenera ENTERO en cada deploy local (todavía sin ABIs). Cuando el frontend añada los
//    ABIs, mantenlos en otro módulo aparte para que este re-deploy no los pise.
export const CHAIN_ID = 31337;

export const ESCROW_ADDRESS = "${ESCROW_ADDRESS}";
export const TKA_ADDRESS = "${TKA_ADDRESS}";
export const TKB_ADDRESS = "${TKB_ADDRESS}";

export const CONTRACTS = {
  chainId: CHAIN_ID,
  escrow: ESCROW_ADDRESS,
  tka: TKA_ADDRESS,
  tkb: TKB_ADDRESS,
} as const;

// TODO(frontend): rellenar los ABIs en el prompt del frontend.
// export const ESCROW_ABI = [/* ... */] as const;
// export const ERC20_ABI = [/* ... */] as const;
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

Tokens autorizados en el Escrow: TKA, TKB
Seed: 1000e18 de cada token a las cuentas Anvil #0, #1, #2
EOF

# 7: mensaje final.
echo ""
echo "==> Despliegue local completado."
echo "    ESCROW: $ESCROW_ADDRESS"
echo "    TKA:    $TKA_ADDRESS"
echo "    TKB:    $TKB_ADDRESS"
echo "    Direcciones exportadas a web/lib/contracts.ts (CHAIN_ID=31337)."
echo "    Listo. Arranca el frontend (cuando exista) con: cd web && npm run dev"
