// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {TokenLibHarness} from "./harness/TokenLibHarness.sol";

contract TokenLibTest is Test {
    TokenLibHarness internal harness;

    address internal tokenA = makeAddr("tokenA");
    address internal tokenB = makeAddr("tokenB");
    address internal tokenC = makeAddr("tokenC");

    function setUp() public {
        harness = new TokenLibHarness();
    }

    function test_add_registersToken() public {
        harness.add(tokenA);

        assertTrue(harness.has(tokenA));
        assertEq(harness.length(), 1);

        address[] memory vals = harness.values();
        assertEq(vals.length, 1);
        assertEq(vals[0], tokenA);
    }

    function test_add_multiple_preservesInsertionOrder() public {
        harness.add(tokenA);
        harness.add(tokenB);
        harness.add(tokenC);

        address[] memory vals = harness.values();
        assertEq(vals.length, 3);
        assertEq(vals[0], tokenA);
        assertEq(vals[1], tokenB);
        assertEq(vals[2], tokenC);
    }

    function test_has_falseForUnknownToken() public {
        harness.add(tokenA);

        assertFalse(harness.has(tokenB));
        assertTrue(harness.has(tokenA));
    }

    function test_length_and_values_coherentAfterMultipleAdds() public {
        assertEq(harness.length(), 0);
        assertEq(harness.values().length, 0);

        harness.add(tokenA);
        harness.add(tokenB);

        assertEq(harness.length(), 2);
        assertEq(harness.values().length, 2);
        assertTrue(harness.has(tokenA));
        assertTrue(harness.has(tokenB));
    }
}
