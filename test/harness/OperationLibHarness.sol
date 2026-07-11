// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Operation} from "../../src/EscrowTypes.sol";
import {OperationLib} from "../../src/libraries/OperationLib.sol";

/// @notice Test harness exposing OperationLib's `internal` functions as `external`, backed by a
///         single `Operation` in storage so tests can invoke them and read the resulting state.
contract OperationLibHarness {
    using OperationLib for Operation;

    Operation internal op;

    function initialize(
        uint256 id,
        address creator,
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        string calldata memoCID
    ) external {
        op.initialize(id, creator, tokenA, tokenB, amountA, amountB, memoCID);
    }

    function markCompleted(address counterparty) external {
        op.markCompleted(counterparty);
    }

    function markCancelled() external {
        op.markCancelled();
    }

    /// @notice Read back the whole struct so tests can assert every field.
    function getOp() external view returns (Operation memory) {
        return op;
    }
}
