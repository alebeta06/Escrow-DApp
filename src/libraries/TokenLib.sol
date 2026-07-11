// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {TokenSet} from "../EscrowTypes.sol";

/// @title TokenLib
/// @notice Set operations over the {TokenSet} allowlist (the EFFECTS side of CEI).
/// @dev Attach with `using TokenLib for TokenSet`. Membership is O(1) via the mapping while
///      `list` keeps insertion order for enumeration. Performs NO external calls or transfers.
/// 🇪🇸 NOTA: esta lib SOLO gestiona el set (EFFECTS). CERO transferencias.
library TokenLib {
    /// @notice Add `token` to the set. Idempotency (rejecting duplicates) is the caller's job.
    /// @param self The token set storage slot.
    /// @param token The token address to add.
    function add(TokenSet storage self, address token) internal {
        self.contains[token] = true;
        self.list.push(token);
    }

    /// @notice Check whether `token` is in the set.
    /// @param self The token set storage slot.
    /// @param token The token address to check.
    /// @return True if present.
    function has(TokenSet storage self, address token) internal view returns (bool) {
        return self.contains[token];
    }

    /// @notice Return every token in the set, in insertion order.
    /// @param self The token set storage slot.
    /// @return The list of member addresses.
    function values(TokenSet storage self) internal view returns (address[] memory) {
        return self.list;
    }

    /// @notice Number of tokens in the set.
    /// @param self The token set storage slot.
    /// @return The member count.
    function length(TokenSet storage self) internal view returns (uint256) {
        return self.list.length;
    }
}
