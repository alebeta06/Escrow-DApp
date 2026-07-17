// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {Escrow} from "../src/Escrow.sol";
import {TestToken} from "../src/mocks/TestToken.sol";

/// @title Deploy
/// @notice Local (Anvil) deployment of the Escrow stack: two TestTokens (TKA/TKB), the Escrow
///         contract, both tokens allowlisted, and 1000 units of each minted to the three
///         standard Anvil accounts so the frontend has seeded balances to play with.
/// @dev Local only — no Sepolia, no verification (that is Fase 2). Run via `deploy.sh`.
/// 🇪🇸 NOTA (owner): el broadcast firma con la private key pasada por `--private-key` (en local,
///          Anvil Account #0). Esa cuenta es msg.sender de cada `new`/llamada, así que el OWNER
///          del Escrow (`Ownable(msg.sender)`) será Account #0.
contract Deploy is Script {
    /// @dev 1000 tokens con 18 decimales, sembrados a cada cuenta.
    uint256 internal constant SEED_AMOUNT = 1_000e18;

    function run() external {
        // 🇪🇸 Destinatarios del seed. DEFAULT: las 3 cuentas estándar de Anvil (#0/#1/#2), para que
        //    el flujo local (anvil → ./deploy.sh → pnpm dev) y los E2E siembren igual SIN configurar
        //    nada. En redes reales (Sepolia) se sobreescribe con la env var MINT_RECIPIENTS
        //    (direcciones separadas por comas), p.ej. el owner del keystore + la cuenta "cliente demo".
        //    `vm.envOr(name, delim, default)` devuelve el default cuando la var no está definida.
        address[] memory defaultRecipients = new address[](3);
        defaultRecipients[0] = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        defaultRecipients[1] = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
        defaultRecipients[2] = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
        address[] memory accounts = vm.envOr("MINT_RECIPIENTS", ",", defaultRecipients);

        vm.startBroadcast();

        // 1-3: despliegue de tokens y escrow.
        TestToken tka = new TestToken("Token A", "TKA");
        TestToken tkb = new TestToken("Token B", "TKB");
        Escrow escrow = new Escrow();

        // 4-5: allowlist de ambos tokens.
        escrow.addToken(address(tka));
        escrow.addToken(address(tkb));

        // 6: seed de balances a las 3 cuentas.
        for (uint256 i = 0; i < accounts.length; i++) {
            tka.mint(accounts[i], SEED_AMOUNT);
            tkb.mint(accounts[i], SEED_AMOUNT);
        }

        vm.stopBroadcast();

        // 7: salida legible (deploy.sh usa run-latest.json, esto es para inspección humana).
        console2.log("ESCROW", address(escrow));
        console2.log("TKA", address(tka));
        console2.log("TKB", address(tkb));
    }
}
