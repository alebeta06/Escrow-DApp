// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {TokenSet} from "../../src/EscrowTypes.sol";
import {TokenLib} from "../../src/libraries/TokenLib.sol";

/// @notice Test harness exposing TokenLib's `internal` functions as `external`, backed by a
///         single `TokenSet` in storage so tests can invoke them and read the resulting state.
contract TokenLibHarness {
    using TokenLib for TokenSet;

    TokenSet internal set;

    function add(address token) external {
        set.add(token);
    }

    function has(address token) external view returns (bool) {
        return set.has(token);
    }

    function values() external view returns (address[] memory) {
        return set.values();
    }

    function length() external view returns (uint256) {
        return set.length();
    }
}
