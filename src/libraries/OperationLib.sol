// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Operation, OperationStatus} from "../EscrowTypes.sol";

/// @title OperationLib
/// @notice State-transition helpers for the {Operation} struct (the EFFECTS side of CEI).
/// @dev Attach with `using OperationLib for Operation`. Every function mutates the operation
///      in storage and performs NO external calls or token transfers — those live in the
///      main contract's INTERACTIONS phase.
/// 🇪🇸 NOTA: esta lib SOLO muta el struct (EFFECTS). CERO transferencias: mantener las
///          interacciones fuera de la lib es lo que garantiza el orden checks-effects-interactions.
library OperationLib {
    /// @notice Populate a freshly-created operation and mark it as `Active`.
    /// @param self The operation storage slot to initialize.
    /// @param id The unique identifier assigned to this operation.
    /// @param creator The address offering `tokenA` and requesting `tokenB`.
    /// @param tokenA The token the creator locks in escrow.
    /// @param tokenB The token the creator wants in return.
    /// @param amountA The amount of `tokenA` offered.
    /// @param amountB The amount of `tokenB` requested.
    /// @param memoCID Optional IPFS CID with extra info ("" allowed).
    function initialize(
        Operation storage self,
        uint256 id,
        address creator,
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        string calldata memoCID
    ) internal {
        self.id = id;
        self.creator = creator;
        self.tokenA = tokenA;
        self.tokenB = tokenB;
        self.amountA = amountA;
        self.amountB = amountB;
        self.memoCID = memoCID;
        self.status = OperationStatus.Active;
        // 🇪🇸 NOTA: counterparty se deja en su valor por defecto (0x0); se fija al completar.
    }

    /// @notice Record the counterparty and mark the operation as `Completed`.
    /// @param self The operation storage slot to update.
    /// @param counterparty The address fulfilling the swap.
    function markCompleted(Operation storage self, address counterparty) internal {
        self.counterparty = counterparty;
        self.status = OperationStatus.Completed;
    }

    /// @notice Mark the operation as `Cancelled`.
    /// @param self The operation storage slot to update.
    function markCancelled(Operation storage self) internal {
        self.status = OperationStatus.Cancelled;
    }
}
