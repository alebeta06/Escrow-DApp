// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Operation, OperationStatus, TokenSet} from "./EscrowTypes.sol";
import {OperationLib} from "./libraries/OperationLib.sol";
import {TokenLib} from "./libraries/TokenLib.sol";

/// @title Escrow
/// @notice Atomic-swap escrow for allowlisted ERC20 tokens. A creator locks `amountA` of
///         `tokenA` and requests `amountB` of `tokenB`; a counterparty fulfils the swap and
///         both legs settle atomically.
/// @dev The contract owns the CHECKS + INTERACTIONS phases; state mutations (EFFECTS) are
///      delegated to {OperationLib} and {TokenLib}. Every write follows a strict
///      checks-effects-interactions ordering and, where it moves tokens, is `nonReentrant`.
/// 🇪🇸 NOTA: reparto de responsabilidades — el contrato valida (CHECKS) y transfiere
///          (INTERACTIONS); las libs mutan el estado (EFFECTS). Ese es el patrón CEI del módulo.
contract Escrow is Ownable, ReentrancyGuard {
    using OperationLib for Operation;
    using TokenLib for TokenSet;

    // ---------------------------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------------------------

    /// @dev All operations ever created, keyed by their sequential id.
    mapping(uint256 => Operation) private _operations;

    /// @dev Total number of operations created; also the id of the next operation.
    uint256 private _operationCount;

    /// @dev Allowlist of tokens that may be swapped.
    TokenSet private _allowedTokens;

    // ---------------------------------------------------------------------------------------
    // Custom errors
    // ---------------------------------------------------------------------------------------

    /// @notice Thrown when a token is not on the allowlist.
    error TokenNotAllowed(address token);
    /// @notice Thrown when trying to allowlist a token that is already allowed.
    error TokenAlreadyAllowed(address token);
    /// @notice Thrown when `tokenA` and `tokenB` are the same token.
    error SameToken(address token);
    /// @notice Thrown when an amount is zero.
    error ZeroAmount();
    /// @notice Thrown when an operation is not in the `Active` status.
    error OperationNotActive(uint256 id);
    /// @notice Thrown when a non-creator tries a creator-only action.
    error NotOperationCreator(uint256 id);
    /// @notice Thrown when the creator tries to complete their own operation.
    error CannotCompleteOwnOperation(uint256 id);

    // ---------------------------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------------------------

    /// @notice Emitted when the owner adds a token to the allowlist.
    event TokenAdded(address indexed token);
    /// @notice Emitted when a new escrow operation is created.
    event OperationCreated(
        uint256 indexed id,
        address indexed creator,
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        string memoCID
    );
    /// @notice Emitted when an operation is completed by a counterparty.
    event OperationCompleted(uint256 indexed id, address indexed counterparty);
    /// @notice Emitted when an operation is cancelled by its creator.
    event OperationCancelled(uint256 indexed id);

    // ---------------------------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------------------------

    /// @notice Deploys the escrow with the deployer as owner/admin.
    /// @dev OpenZeppelin v5 `Ownable` requires an explicit `initialOwner`; we pass `msg.sender`.
    /// 🇪🇸 NOTA: en OZ v5 el constructor de Ownable exige initialOwner (no asume msg.sender).
    constructor() Ownable(msg.sender) {}

    // ---------------------------------------------------------------------------------------
    // Writes
    // ---------------------------------------------------------------------------------------

    /// @notice Add a token to the swap allowlist.
    /// @param token The ERC20 token to allow.
    function addToken(address token) external onlyOwner {
        // checks
        if (_allowedTokens.has(token)) revert TokenAlreadyAllowed(token);

        // effects
        _allowedTokens.add(token);
        emit TokenAdded(token);
        // 🇪🇸 NOTA: sin interactions — addToken no mueve tokens, solo gestiona el allowlist.
    }

    /// @notice Create an escrow operation, locking `amountA` of `tokenA` in the contract.
    /// @param tokenA The token the caller offers (must be allowlisted).
    /// @param tokenB The token the caller requests (must be allowlisted).
    /// @param amountA The amount of `tokenA` to lock (> 0).
    /// @param amountB The amount of `tokenB` requested (> 0).
    /// @param memoCID Optional IPFS CID with extra info ("" allowed).
    /// @return id The id of the newly created operation.
    function createOperation(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        string calldata memoCID
    ) external nonReentrant returns (uint256 id) {
        // checks
        if (!_allowedTokens.has(tokenA)) revert TokenNotAllowed(tokenA);
        if (!_allowedTokens.has(tokenB)) revert TokenNotAllowed(tokenB);
        if (tokenA == tokenB) revert SameToken(tokenA);
        if (amountA == 0 || amountB == 0) revert ZeroAmount();

        // effects
        id = _operationCount;
        _operations[id].initialize(id, msg.sender, tokenA, tokenB, amountA, amountB, memoCID);
        _operationCount++;
        emit OperationCreated(id, msg.sender, tokenA, tokenB, amountA, amountB, memoCID);

        // 🇪🇸 NOTA: EFFECTS antes que INTERACTIONS — el estado queda consistente ANTES de la
        //          llamada externa, de modo que una reentrada vería la operación ya registrada.
        // interactions
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
    }

    /// @notice Complete an active operation: the caller pays `amountB` of `tokenB` to the
    ///         creator and receives the escrowed `amountA` of `tokenA`.
    /// @param id The operation to complete.
    function completeOperation(uint256 id) external nonReentrant {
        Operation storage op = _operations[id];

        // checks
        if (op.status != OperationStatus.Active) revert OperationNotActive(id);
        if (msg.sender == op.creator) revert CannotCompleteOwnOperation(id);

        // effects
        op.markCompleted(msg.sender);
        emit OperationCompleted(id, msg.sender);

        // 🇪🇸 NOTA: se marca Completed ANTES de transferir — así el swap es atómico y una
        //          reentrada encontraría la operación ya cerrada (no reejecutable).
        // interactions
        IERC20(op.tokenB).transferFrom(msg.sender, op.creator, op.amountB);
        IERC20(op.tokenA).transfer(msg.sender, op.amountA);
    }

    /// @notice Cancel an active operation and refund the escrowed `tokenA` to its creator.
    /// @param id The operation to cancel.
    function cancelOperation(uint256 id) external nonReentrant {
        Operation storage op = _operations[id];

        // checks
        if (op.status != OperationStatus.Active) revert OperationNotActive(id);
        if (msg.sender != op.creator) revert NotOperationCreator(id);

        // effects
        op.markCancelled();
        emit OperationCancelled(id);

        // 🇪🇸 NOTA: Cancelled ANTES del refund — el estado final se fija primero y la
        //          transferencia va después (CEI), evitando doble-cancelación por reentrada.
        // interactions
        IERC20(op.tokenA).transfer(op.creator, op.amountA);
    }

    // ---------------------------------------------------------------------------------------
    // Reads (views)
    // ---------------------------------------------------------------------------------------

    /// @notice Return every allowlisted token.
    /// @return The list of allowed token addresses.
    function getAllowedTokens() external view returns (address[] memory) {
        return _allowedTokens.values();
    }

    /// @notice Return every operation ever created, in id order.
    /// @return all The full list of operations.
    function getAllOperations() external view returns (Operation[] memory all) {
        all = new Operation[](_operationCount);
        for (uint256 i = 0; i < _operationCount; i++) {
            all[i] = _operations[i];
        }
    }

    /// @notice Return a single operation by id.
    /// @param id The operation id.
    /// @return The operation.
    function getOperation(uint256 id) external view returns (Operation memory) {
        return _operations[id];
    }

    /// @notice Return every operation created by `creator`.
    /// @param creator The creator to filter by.
    /// @return result The creator's operations.
    function getOperationsByCreator(address creator) external view returns (Operation[] memory result) {
        // First pass: count matches so we can size the array exactly.
        uint256 matches;
        for (uint256 i = 0; i < _operationCount; i++) {
            if (_operations[i].creator == creator) matches++;
        }

        // Second pass: fill.
        result = new Operation[](matches);
        uint256 j;
        for (uint256 i = 0; i < _operationCount; i++) {
            if (_operations[i].creator == creator) {
                result[j] = _operations[i];
                j++;
            }
        }
    }

    /// @notice Return every operation currently in `Active` status.
    /// @return result The active operations.
    function getActiveOperations() external view returns (Operation[] memory result) {
        // First pass: count actives.
        uint256 matches;
        for (uint256 i = 0; i < _operationCount; i++) {
            if (_operations[i].status == OperationStatus.Active) matches++;
        }

        // Second pass: fill.
        result = new Operation[](matches);
        uint256 j;
        for (uint256 i = 0; i < _operationCount; i++) {
            if (_operations[i].status == OperationStatus.Active) {
                result[j] = _operations[i];
                j++;
            }
        }
    }

    /// @notice Whether `token` is on the allowlist.
    /// @param token The token to check.
    /// @return True if allowed.
    function isTokenAllowed(address token) external view returns (bool) {
        return _allowedTokens.has(token);
    }

    /// @notice Total number of operations created.
    /// @return The operation count.
    function getOperationCount() external view returns (uint256) {
        return _operationCount;
    }

    /// @notice Number of allowlisted tokens.
    /// @return The token count.
    function getTokenCount() external view returns (uint256) {
        return _allowedTokens.length();
    }
}
