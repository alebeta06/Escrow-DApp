// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestToken
/// @notice Minimal mintable ERC20 used only for local/testnet testing (e.g. TKA and TKB).
/// @dev Name and symbol are set at construction; decimals default to 18 (OpenZeppelin's ERC20).
/// 🇪🇸 NOTA: es un MOCK de test — `mint` es público y sin control de acceso a propósito, para
///          poder repartir balances libremente en tests y despliegues de prueba. NUNCA usar en prod.
contract TestToken is ERC20 {
    /// @param name_ The token name.
    /// @param symbol_ The token symbol.
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    /// @notice Mint `amount` tokens to `to`. Open on purpose (test-only mock).
    /// @param to The recipient.
    /// @param amount The amount to mint.
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
