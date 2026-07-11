// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {OperationLibHarness} from "./harness/OperationLibHarness.sol";
import {Operation, OperationStatus} from "../src/EscrowTypes.sol";

contract OperationLibTest is Test {
    OperationLibHarness internal harness;

    address internal creator = makeAddr("creator");
    address internal counterparty = makeAddr("counterparty");
    address internal tokenA = makeAddr("tokenA");
    address internal tokenB = makeAddr("tokenB");

    function setUp() public {
        harness = new OperationLibHarness();
    }

    function test_initialize_setsAllFields() public {
        harness.initialize(42, creator, tokenA, tokenB, 100, 200, "QmMemo");

        Operation memory op = harness.getOp();
        assertEq(op.id, 42);
        assertEq(op.creator, creator);
        assertEq(op.counterparty, address(0)); // no seteado hasta completar
        assertEq(op.tokenA, tokenA);
        assertEq(op.tokenB, tokenB);
        assertEq(op.amountA, 100);
        assertEq(op.amountB, 200);
        assertEq(op.memoCID, "QmMemo");
        assertEq(uint256(op.status), uint256(OperationStatus.Active));
    }

    function test_markCompleted_setsCounterpartyAndStatus() public {
        harness.initialize(1, creator, tokenA, tokenB, 100, 200, "");
        harness.markCompleted(counterparty);

        Operation memory op = harness.getOp();
        assertEq(op.counterparty, counterparty);
        assertEq(uint256(op.status), uint256(OperationStatus.Completed));
        // el resto de campos permanece intacto
        assertEq(op.id, 1);
        assertEq(op.creator, creator);
        assertEq(op.amountA, 100);
        assertEq(op.amountB, 200);
    }

    function test_markCancelled_setsStatus() public {
        harness.initialize(7, creator, tokenA, tokenB, 100, 200, "");
        harness.markCancelled();

        Operation memory op = harness.getOp();
        assertEq(uint256(op.status), uint256(OperationStatus.Cancelled));
        assertEq(op.counterparty, address(0)); // cancelar no fija counterparty
        assertEq(op.creator, creator);
    }
}
