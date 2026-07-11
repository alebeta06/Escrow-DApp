// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Escrow} from "../src/Escrow.sol";
import {TestToken} from "../src/mocks/TestToken.sol";
import {Operation, OperationStatus} from "../src/EscrowTypes.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract EscrowTest is Test {
    Escrow internal escrow;
    TestToken internal tka;
    TestToken internal tkb;

    address internal creator = makeAddr("creator");
    address internal counterparty = makeAddr("counterparty");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant INIT = 1_000e18;
    uint256 internal constant AMOUNT_A = 100e18;
    uint256 internal constant AMOUNT_B = 200e18;

    // Eventos redeclarados para usarlos con vm.expectEmit.
    event TokenAdded(address indexed token);
    event OperationCreated(
        uint256 indexed id,
        address indexed creator,
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        string memoCID
    );
    event OperationCompleted(uint256 indexed id, address indexed counterparty);
    event OperationCancelled(uint256 indexed id);

    function setUp() public {
        // owner = address(this)
        escrow = new Escrow();
        tka = new TestToken("Token A", "TKA");
        tkb = new TestToken("Token B", "TKB");

        escrow.addToken(address(tka));
        escrow.addToken(address(tkb));

        // Ambos actores con saldo de ambos tokens (las aserciones usan deltas, no absolutos).
        tka.mint(creator, INIT);
        tkb.mint(creator, INIT);
        tka.mint(counterparty, INIT);
        tkb.mint(counterparty, INIT);
    }

    // Helper: creator abre una operación (approve + createOperation) y devuelve su id.
    function _createOp(string memory memo) internal returns (uint256 id) {
        vm.startPrank(creator);
        tka.approve(address(escrow), AMOUNT_A);
        id = escrow.createOperation(address(tka), address(tkb), AMOUNT_A, AMOUNT_B, memo);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------------------------
    // Happy paths
    // ---------------------------------------------------------------------------------------

    function test_addToken_allowsAndEmits() public {
        TestToken tkc = new TestToken("Token C", "TKC");

        vm.expectEmit(true, false, false, false, address(escrow));
        emit TokenAdded(address(tkc));
        escrow.addToken(address(tkc));

        assertTrue(escrow.isTokenAllowed(address(tkc)));
        assertEq(escrow.getTokenCount(), 3);
    }

    function test_createOperation_locksTokensAndStoresActive() public {
        uint256 creatorBefore = tka.balanceOf(creator);
        uint256 escrowBefore = tka.balanceOf(address(escrow));

        vm.startPrank(creator);
        tka.approve(address(escrow), AMOUNT_A);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit OperationCreated(0, creator, address(tka), address(tkb), AMOUNT_A, AMOUNT_B, "QmMemo");
        uint256 id = escrow.createOperation(address(tka), address(tkb), AMOUNT_A, AMOUNT_B, "QmMemo");
        vm.stopPrank();

        assertEq(id, 0);
        // balances: los tokens del creador quedan bloqueados en el contrato
        assertEq(tka.balanceOf(creator), creatorBefore - AMOUNT_A);
        assertEq(tka.balanceOf(address(escrow)), escrowBefore + AMOUNT_A);

        Operation memory op = escrow.getOperation(0);
        assertEq(op.id, 0);
        assertEq(op.creator, creator);
        assertEq(op.counterparty, address(0));
        assertEq(op.tokenA, address(tka));
        assertEq(op.tokenB, address(tkb));
        assertEq(op.amountA, AMOUNT_A);
        assertEq(op.amountB, AMOUNT_B);
        assertEq(op.memoCID, "QmMemo");
        assertEq(uint256(op.status), uint256(OperationStatus.Active));
        assertEq(escrow.getOperationCount(), 1);
    }

    function test_createOperation_emptyMemoCID_works() public {
        uint256 id = _createOp("");
        Operation memory op = escrow.getOperation(id);
        assertEq(op.memoCID, "");
        assertEq(uint256(op.status), uint256(OperationStatus.Active));
    }

    function test_completeOperation_swapsBalancesAndCompletes() public {
        uint256 id = _createOp("");

        uint256 creatorTkbBefore = tkb.balanceOf(creator);
        uint256 cpTkaBefore = tka.balanceOf(counterparty);
        uint256 cpTkbBefore = tkb.balanceOf(counterparty);
        uint256 escrowTkaBefore = tka.balanceOf(address(escrow));

        vm.startPrank(counterparty);
        tkb.approve(address(escrow), AMOUNT_B);
        vm.expectEmit(true, true, false, false, address(escrow));
        emit OperationCompleted(id, counterparty);
        escrow.completeOperation(id);
        vm.stopPrank();

        // creator recibe tokenB; counterparty recibe tokenA y paga tokenB; escrow se vacía de tokenA
        assertEq(tkb.balanceOf(creator), creatorTkbBefore + AMOUNT_B);
        assertEq(tka.balanceOf(counterparty), cpTkaBefore + AMOUNT_A);
        assertEq(tkb.balanceOf(counterparty), cpTkbBefore - AMOUNT_B);
        assertEq(tka.balanceOf(address(escrow)), escrowTkaBefore - AMOUNT_A);

        Operation memory op = escrow.getOperation(id);
        assertEq(uint256(op.status), uint256(OperationStatus.Completed));
        assertEq(op.counterparty, counterparty);
    }

    function test_cancelOperation_refundsCreatorAndCancels() public {
        uint256 id = _createOp("");

        uint256 creatorTkaBefore = tka.balanceOf(creator);
        uint256 escrowTkaBefore = tka.balanceOf(address(escrow));

        vm.startPrank(creator);
        vm.expectEmit(true, false, false, false, address(escrow));
        emit OperationCancelled(id);
        escrow.cancelOperation(id);
        vm.stopPrank();

        // refund íntegro del tokenA al creator
        assertEq(tka.balanceOf(creator), creatorTkaBefore + AMOUNT_A);
        assertEq(tka.balanceOf(address(escrow)), escrowTkaBefore - AMOUNT_A);

        Operation memory op = escrow.getOperation(id);
        assertEq(uint256(op.status), uint256(OperationStatus.Cancelled));
    }

    // ---------------------------------------------------------------------------------------
    // Reverts (uno por custom error / branch)
    // ---------------------------------------------------------------------------------------

    function testRevert_addToken_alreadyAllowed() public {
        vm.expectRevert(abi.encodeWithSelector(Escrow.TokenAlreadyAllowed.selector, address(tka)));
        escrow.addToken(address(tka));
    }

    function testRevert_addToken_notOwner() public {
        address newToken = makeAddr("newToken");
        vm.startPrank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        escrow.addToken(newToken);
        vm.stopPrank();
    }

    function testRevert_createOperation_tokenANotAllowed() public {
        address bad = makeAddr("bad");
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSelector(Escrow.TokenNotAllowed.selector, bad));
        escrow.createOperation(bad, address(tkb), AMOUNT_A, AMOUNT_B, "");
        vm.stopPrank();
    }

    function testRevert_createOperation_tokenBNotAllowed() public {
        address bad = makeAddr("bad");
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSelector(Escrow.TokenNotAllowed.selector, bad));
        escrow.createOperation(address(tka), bad, AMOUNT_A, AMOUNT_B, "");
        vm.stopPrank();
    }

    function testRevert_createOperation_sameToken() public {
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSelector(Escrow.SameToken.selector, address(tka)));
        escrow.createOperation(address(tka), address(tka), AMOUNT_A, AMOUNT_B, "");
        vm.stopPrank();
    }

    function testRevert_createOperation_zeroAmountA() public {
        vm.startPrank(creator);
        vm.expectRevert(Escrow.ZeroAmount.selector);
        escrow.createOperation(address(tka), address(tkb), 0, AMOUNT_B, "");
        vm.stopPrank();
    }

    function testRevert_createOperation_zeroAmountB() public {
        vm.startPrank(creator);
        vm.expectRevert(Escrow.ZeroAmount.selector);
        escrow.createOperation(address(tka), address(tkb), AMOUNT_A, 0, "");
        vm.stopPrank();
    }

    function testRevert_createOperation_noApprove() public {
        // creator NO aprueba → SafeERC20.safeTransferFrom revierte con el error estándar ERC-6093
        vm.startPrank(creator);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(escrow), 0, AMOUNT_A)
        );
        escrow.createOperation(address(tka), address(tkb), AMOUNT_A, AMOUNT_B, "");
        vm.stopPrank();
    }

    function testRevert_completeOperation_notActive() public {
        uint256 id = _createOp("");
        vm.startPrank(creator);
        escrow.cancelOperation(id); // la deja Cancelled
        vm.stopPrank();

        vm.startPrank(counterparty);
        vm.expectRevert(abi.encodeWithSelector(Escrow.OperationNotActive.selector, id));
        escrow.completeOperation(id);
        vm.stopPrank();
    }

    function testRevert_completeOperation_byCreator() public {
        uint256 id = _createOp("");
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSelector(Escrow.CannotCompleteOwnOperation.selector, id));
        escrow.completeOperation(id);
        vm.stopPrank();
    }

    function testRevert_cancelOperation_notCreator() public {
        uint256 id = _createOp("");
        vm.startPrank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Escrow.NotOperationCreator.selector, id));
        escrow.cancelOperation(id);
        vm.stopPrank();
    }

    function testRevert_cancelOperation_notActive() public {
        uint256 id = _createOp("");
        vm.startPrank(counterparty);
        tkb.approve(address(escrow), AMOUNT_B);
        escrow.completeOperation(id); // la deja Completed
        vm.stopPrank();

        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSelector(Escrow.OperationNotActive.selector, id));
        escrow.cancelOperation(id);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------

    function test_getAllOperations_returnsAll() public {
        _createOp("");
        _createOp("");

        Operation[] memory all = escrow.getAllOperations();
        assertEq(all.length, 2);
        assertEq(all[0].id, 0);
        assertEq(all[1].id, 1);
        assertEq(all[0].creator, creator);
    }

    function test_getOperation_returnsData() public {
        uint256 id = _createOp("QmX");
        Operation memory op = escrow.getOperation(id);
        assertEq(op.id, id);
        assertEq(op.creator, creator);
        assertEq(op.tokenA, address(tka));
        assertEq(op.tokenB, address(tkb));
        assertEq(op.memoCID, "QmX");
    }

    function test_getOperationsByCreator_filters() public {
        // op 0 por creator
        _createOp("");
        // op 1 por counterparty
        vm.startPrank(counterparty);
        tka.approve(address(escrow), AMOUNT_A);
        escrow.createOperation(address(tka), address(tkb), AMOUNT_A, AMOUNT_B, "");
        vm.stopPrank();

        Operation[] memory byCreator = escrow.getOperationsByCreator(creator);
        assertEq(byCreator.length, 1);
        assertEq(byCreator[0].id, 0);
        assertEq(byCreator[0].creator, creator);

        Operation[] memory byCp = escrow.getOperationsByCreator(counterparty);
        assertEq(byCp.length, 1);
        assertEq(byCp[0].id, 1);
        assertEq(byCp[0].creator, counterparty);
    }

    function test_getOperationsByCreator_emptyForUnknown() public {
        _createOp("");
        Operation[] memory none = escrow.getOperationsByCreator(stranger);
        assertEq(none.length, 0);
    }

    function test_getActiveOperations_excludesCompletedAndCancelled() public {
        uint256 id0 = _createOp("");
        uint256 id1 = _createOp("");
        uint256 id2 = _createOp("");

        vm.startPrank(counterparty);
        tkb.approve(address(escrow), AMOUNT_B);
        escrow.completeOperation(id0); // Completed
        vm.stopPrank();

        vm.startPrank(creator);
        escrow.cancelOperation(id1); // Cancelled
        vm.stopPrank();

        Operation[] memory active = escrow.getActiveOperations();
        assertEq(active.length, 1);
        assertEq(active[0].id, id2);
        assertEq(uint256(active[0].status), uint256(OperationStatus.Active));
    }

    function test_getActiveOperations_emptyWhenAllClosed() public {
        uint256 id0 = _createOp("");
        uint256 id1 = _createOp("");

        vm.startPrank(counterparty);
        tkb.approve(address(escrow), AMOUNT_B);
        escrow.completeOperation(id0);
        vm.stopPrank();

        vm.startPrank(creator);
        escrow.cancelOperation(id1);
        vm.stopPrank();

        Operation[] memory active = escrow.getActiveOperations();
        assertEq(active.length, 0);
    }

    function test_getAllowedTokens_and_isTokenAllowed() public {
        address[] memory allowed = escrow.getAllowedTokens();
        assertEq(allowed.length, 2);
        assertEq(allowed[0], address(tka));
        assertEq(allowed[1], address(tkb));

        assertTrue(escrow.isTokenAllowed(address(tka)));
        assertFalse(escrow.isTokenAllowed(makeAddr("nope")));
    }

    function test_getOperationCount_and_getTokenCount() public {
        assertEq(escrow.getTokenCount(), 2);
        assertEq(escrow.getOperationCount(), 0);
        _createOp("");
        assertEq(escrow.getOperationCount(), 1);
    }
}
