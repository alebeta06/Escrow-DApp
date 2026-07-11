// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title EscrowTypes
/// @notice Shared domain types used by the Escrow contract and its libraries.
/// @dev Kept in a dedicated file so both the libraries and the main contract can import them
///      without creating a circular dependency.
/// 🇪🇸 NOTA: al vivir aquí los tipos, las libs (OperationLib/TokenLib) y Escrow los comparten
///          sin que ninguno tenga que importar al otro → evita ciclos de importación.

/// @notice Lifecycle status of an escrow operation.
enum OperationStatus {
    Active,
    Completed,
    Cancelled
}

/// @notice A single atomic-swap escrow operation.
/// @dev `creator` locks `amountA` of `tokenA` and asks for `amountB` of `tokenB` in return.
///      `counterparty` stays `address(0)` until the swap is completed.
struct Operation {
    uint256 id;
    address creator;
    address counterparty; // 🇪🇸 NOTA: 0x0 hasta completar; se fija al que ejecuta completeOperation
    address tokenA; // el creador OFRECE
    address tokenB; // el creador PIDE
    uint256 amountA;
    uint256 amountB;
    OperationStatus status;
    string memoCID; // IPFS opcional, "" permitido
}

/// @notice An address set with O(1) membership checks plus an enumerable list.
/// @dev Storage-only: it holds a `mapping`, so it can never be returned or passed in `memory`.
/// 🇪🇸 NOTA: `contains` da pertenencia en O(1); `list` permite enumerar (las views devuelven
///          `address[]` construido a partir de `list`, nunca el `TokenSet` completo).
struct TokenSet {
    address[] list;
    mapping(address => bool) contains;
}
