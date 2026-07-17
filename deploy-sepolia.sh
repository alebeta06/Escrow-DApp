#!/usr/bin/env bash
#
# deploy-sepolia.sh — Despliegue del Escrow en Ethereum Sepolia (testnet PÚBLICA, gasta gas real).
#
# SEPARADO de deploy.sh a propósito: deploy.sh es Anvil-puro, repetible y sin coste; este es una
# operación seria, irreversible y con coste de gas. NO mezclarlos evita accidentes.
#
# Firma con el KEYSTORE cifrado de Foundry (--account), nunca con la clave en claro: Foundry pedirá
# la passphrase de forma interactiva al firmar. Por eso este script lo ejecuta la persona, no un
# entorno no-interactivo.
#
# Lee su configuración del .env de la RAÍZ del repo (gitignored). Variables esperadas:
#   SEPOLIA_RPC_URL   — RPC de Sepolia (p.ej. Alchemy).
#   ETHERSCAN_API_KEY — para la verificación en Etherscan.
#   DEPLOYER_ACCOUNT  — alias del keystore de Foundry (p.ej. alebeta-admin). Será el OWNER del Escrow.
#   DEPLOYER_ADDRESS  — dirección pública de ese keystore. Se usa como --sender y como 1er
#                       destinatario del mint. DEBE coincidir con el keystore de DEPLOYER_ACCOUNT.
#   CLIENT_ADDRESS    — cuenta "cliente demo" (contraparte del swap); 2º destinatario del mint.
#
# Uso:  ./deploy-sepolia.sh        (desde la raíz del repo, con el .env relleno)

set -euo pipefail

# 🇪🇸 Trabajar siempre desde la raíz del repo (donde vive el .env y el proyecto Foundry).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Red esperada: Sepolia.
readonly EXPECTED_CHAIN_ID=11155111
readonly EXPECTED_CHAIN_HEX="0xaa36a7"
readonly RUN_LATEST="broadcast/Deploy.s.sol/${EXPECTED_CHAIN_ID}/run-latest.json"

# ── 1: cargar y validar el .env ──────────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  echo "ERROR: no encuentro el .env en la raíz del repo ($SCRIPT_DIR/.env)." >&2
  echo "       Créalo con SEPOLIA_RPC_URL, ETHERSCAN_API_KEY, DEPLOYER_ACCOUNT, DEPLOYER_ADDRESS," >&2
  echo "       CLIENT_ADDRESS. Está gitignored (no se commitea)." >&2
  exit 1
fi

# 🇪🇸 `set -a` exporta todo lo que se defina al sourcear → forge (vm.envOr) verá MINT_RECIPIENTS.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

# Validar que las 5 variables estén definidas y no vacías (mensaje claro si falta alguna).
: "${SEPOLIA_RPC_URL:?falta SEPOLIA_RPC_URL en .env}"
: "${ETHERSCAN_API_KEY:?falta ETHERSCAN_API_KEY en .env}"
: "${DEPLOYER_ACCOUNT:?falta DEPLOYER_ACCOUNT (alias del keystore) en .env}"
: "${DEPLOYER_ADDRESS:?falta DEPLOYER_ADDRESS (dirección del keystore) en .env}"
: "${CLIENT_ADDRESS:?falta CLIENT_ADDRESS (contraparte demo) en .env}"

# ── 2: health-check del RPC (que responda y sea Sepolia) ─────────────────────────────────────────
echo "==> Comprobando que el RPC responde y es Sepolia ($EXPECTED_CHAIN_ID) ..."
CHAIN_HEX="$(curl -s -X POST "$SEPOLIA_RPC_URL" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  --max-time 10 | grep -o '0x[0-9a-fA-F]\+' | head -1 || true)"

if [[ -z "$CHAIN_HEX" ]]; then
  echo "ERROR: el RPC ($SEPOLIA_RPC_URL) no respondió a eth_chainId. Revisa SEPOLIA_RPC_URL." >&2
  exit 1
fi
if [[ "$CHAIN_HEX" != "$EXPECTED_CHAIN_HEX" ]]; then
  echo "ERROR: el RPC devolvió chainId $CHAIN_HEX, esperaba $EXPECTED_CHAIN_HEX (Sepolia)." >&2
  echo "       Estás apuntando a otra red. Abortando para no desplegar donde no toca." >&2
  exit 1
fi
echo "    OK: chainId $CHAIN_HEX (Sepolia)."

# ── 3: desplegar ─────────────────────────────────────────────────────────────────────────────────
# 🇪🇸 MINT_RECIPIENTS lo consume Deploy.s.sol vía vm.envOr("MINT_RECIPIENTS", ",", <default Anvil>).
#    Aquí lo forzamos al owner + cliente demo (en local, sin la var, mintearía a las 3 de Anvil).
export MINT_RECIPIENTS="${DEPLOYER_ADDRESS},${CLIENT_ADDRESS}"

# 🇪🇸 --account: firma con el keystore cifrado (pide passphrase). --sender: el owner (Ownable(msg.sender)).
#    --slow: una tx a la vez esperando receipt (evita huecos de nonce; Sepolia es más lento y
#    arriesgado que Anvil). --verify: verifica en Etherscan durante el broadcast, inyectando los
#    constructor args CORRECTOS por contrato desde los metadatos del broadcast — clave porque hay dos
#    TestToken con args distintos (Token A/TKA vs Token B/TKB); Escrow no tiene args.
echo "==> Desplegando en Sepolia (owner=$DEPLOYER_ADDRESS, seed a owner + cliente demo) ..."
echo "    Foundry pedirá la passphrase del keystore '$DEPLOYER_ACCOUNT' para firmar."
forge script script/Deploy.s.sol \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --account "$DEPLOYER_ACCOUNT" \
  --sender "$DEPLOYER_ADDRESS" \
  --chain sepolia \
  --slow \
  --broadcast \
  --verify \
  --etherscan-api-key "$ETHERSCAN_API_KEY"

# 🇪🇸 FALLBACK de verificación: si Etherscan aún no había indexado el bytecode y --verify falló (el
#    DEPLOY sí se completó — los contratos ya están en cadena), reverifica por contrato desde la raíz:
#      forge verify-contract <TKA_ADDR> src/mocks/TestToken.sol:TestToken --chain sepolia \
#        --etherscan-api-key "$ETHERSCAN_API_KEY" \
#        --constructor-args "$(cast abi-encode 'constructor(string,string)' 'Token A' 'TKA')"
#      forge verify-contract <TKB_ADDR> src/mocks/TestToken.sol:TestToken --chain sepolia \
#        --etherscan-api-key "$ETHERSCAN_API_KEY" \
#        --constructor-args "$(cast abi-encode 'constructor(string,string)' 'Token B' 'TKB')"
#      forge verify-contract <ESCROW_ADDR> src/Escrow.sol:Escrow --chain sepolia \
#        --etherscan-api-key "$ETHERSCAN_API_KEY"

# ── 4: parsear direcciones + deploy block desde run-latest.json ──────────────────────────────────
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

# 🇪🇸 El deploy block del Escrow vive en receipts (hex). Desde ahí escanea el indexer (nunca desde 0).
deploy_block = None
for r in data.get("receipts", []):
    if (r.get("contractAddress") or "").lower() == escrow.lower():
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

# ── 5: deployment-info-sepolia.txt (artefacto legible, gitignored) ───────────────────────────────
echo "==> Generando deployment-info-sepolia.txt ..."
cat > deployment-info-sepolia.txt <<EOF
Escrow DApp — Despliegue en SEPOLIA
===================================
Fecha:   $(date -u '+%Y-%m-%d %H:%M:%S UTC')
Red:     Ethereum Sepolia (chainId ${EXPECTED_CHAIN_ID})
Owner:   ${DEPLOYER_ADDRESS}  (keystore '${DEPLOYER_ACCOUNT}')

Contratos:
  ESCROW: ${ESCROW_ADDRESS}
  TKA:    ${TKA_ADDRESS}
  TKB:    ${TKB_ADDRESS}

Deploy block (Escrow): ${DEPLOY_BLOCK}

Tokens autorizados en el Escrow: TKA, TKB
Seed: 1000e18 de cada token a: ${DEPLOYER_ADDRESS} (owner), ${CLIENT_ADDRESS} (cliente demo)

Etherscan:
  ESCROW: https://sepolia.etherscan.io/address/${ESCROW_ADDRESS}
  TKA:    https://sepolia.etherscan.io/address/${TKA_ADDRESS}
  TKB:    https://sepolia.etherscan.io/address/${TKB_ADDRESS}
EOF

# ── 6: variables NEXT_PUBLIC_* listas para el dashboard de Vercel (rebanada 3/3) ─────────────────
echo ""
echo "==> Despliegue en Sepolia completado."
echo ""
echo "    Copia estas 5 variables en Vercel (Project → Settings → Environment Variables):"
echo ""
echo "    NEXT_PUBLIC_ESCROW_ADDRESS=${ESCROW_ADDRESS}"
echo "    NEXT_PUBLIC_TKA_ADDRESS=${TKA_ADDRESS}"
echo "    NEXT_PUBLIC_TKB_ADDRESS=${TKB_ADDRESS}"
echo "    NEXT_PUBLIC_CHAIN_ID=${EXPECTED_CHAIN_ID}"
echo "    NEXT_PUBLIC_DEPLOY_BLOCK=${DEPLOY_BLOCK}"
echo ""
echo "    (También en deployment-info-sepolia.txt, con los enlaces a Etherscan.)"
