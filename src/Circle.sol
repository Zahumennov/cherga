// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Circle
/// @notice A single rotating savings circle (ROSCA). One contract per circle.
contract Circle {
    using SafeERC20 for IERC20;

    enum State {
        Forming,
        Active,
        Cancelled,
        Completed
    }

    struct Round {
        uint256 collected;
        bool closed;
    }

    // --- errors ---

    error NotImplemented();
    error ZeroAddress();
    error ZeroContribution();
    error InvalidMemberCount();
    error InvalidRoundDuration();
    error FillDeadlineInPast();
    error WrongState(State expected, State actual);
    error CircleFull();
    error AlreadyMember();
    error NotMember();
    error FillDeadlinePassed();
    error FillDeadlineNotPassed();
    error CircleNotStarted();
    error IsRecipient();
    error AlreadyContributed();
    error RoundNotReady();
    error NothingToClaim();

    // --- events ---

    event CircleCreated(
        address indexed token, uint256 contribution, uint8 memberCount, uint32 roundDuration, uint64 fillDeadline
    );
    event MemberJoined(address indexed member, uint8 position);
    event CircleActivated(uint64 roundEnd);
    event CircleCancelled();
    event Contributed(address indexed member, uint8 indexed round, uint256 amount);
    event RoundClosed(uint8 indexed round, address indexed recipient, uint256 collected, uint256 shortfall);
    event Claimed(address indexed member, uint256 amount);
    event Repaid(address indexed debtor, address indexed creditor, uint256 amount);

    // --- immutable circle parameters ---

    address public immutable token;
    uint256 public immutable contribution;
    uint8 public immutable memberCount;
    uint32 public immutable roundDuration;
    uint64 public immutable fillDeadline;

    // --- state ---

    State public state;
    address[] public order;
    uint8 public currentRound;
    uint64 public roundEnd;

    mapping(address member => bool) public isMember;
    mapping(uint8 round => Round) public rounds;
    mapping(uint8 round => mapping(address member => bool)) public hasContributed;
    mapping(address debtor => mapping(address creditor => uint256)) public debts;
    mapping(address member => uint256) public claimable;

    // --- modifiers ---

    modifier onlyState(State expected) {
        if (state != expected) revert WrongState(expected, state);
        _;
    }

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    /// @dev Allows Active and Completed — both still handle claims and repayments.
    modifier circleStarted() {
        if (state == State.Forming || state == State.Cancelled) revert CircleNotStarted();
        _;
    }

    constructor(
        address token_,
        uint256 contribution_,
        uint8 memberCount_,
        uint32 roundDuration_,
        uint64 fillDeadline_
    ) {
        if (token_ == address(0)) revert ZeroAddress();
        if (contribution_ == 0) revert ZeroContribution();
        if (memberCount_ < 2 || memberCount_ > 20) revert InvalidMemberCount();
        if (roundDuration_ == 0) revert InvalidRoundDuration();
        if (fillDeadline_ <= block.timestamp) revert FillDeadlineInPast();

        token = token_;
        contribution = contribution_;
        memberCount = memberCount_;
        roundDuration = roundDuration_;
        fillDeadline = fillDeadline_;
        state = State.Forming;

        emit CircleCreated(token_, contribution_, memberCount_, roundDuration_, fillDeadline_);
    }

    /// @notice Join the circle. Queue position is assigned in join order.
    function join() external onlyState(State.Forming) {
        if (block.timestamp >= fillDeadline) revert FillDeadlinePassed();
        if (isMember[msg.sender]) revert AlreadyMember();
        if (order.length >= memberCount) revert CircleFull();

        isMember[msg.sender] = true;
        order.push(msg.sender);

        emit MemberJoined(msg.sender, uint8(order.length - 1));

        if (order.length == memberCount) {
            state = State.Active;
            currentRound = 1;
            roundEnd = uint64(block.timestamp) + roundDuration;
            emit CircleActivated(roundEnd);
        }
    }

    /// @notice Cancel a circle that failed to fill before its deadline.
    function cancel() external onlyState(State.Forming) {
        if (block.timestamp < fillDeadline) revert FillDeadlineNotPassed();

        state = State.Cancelled;

        emit CircleCancelled();
    }

    /// @notice Pay this round's contribution.
    function contribute() external onlyState(State.Active) onlyMember {
        if (msg.sender == order[currentRound - 1]) revert IsRecipient();
        if (hasContributed[currentRound][msg.sender]) revert AlreadyContributed();

        hasContributed[currentRound][msg.sender] = true;
        rounds[currentRound].collected += contribution;

        emit Contributed(msg.sender, currentRound, contribution);

        IERC20(token).safeTransferFrom(msg.sender, address(this), contribution);
    }

    /// @notice Close the current round and advance the queue.
    function closeRound() external onlyState(State.Active) {
        uint256 expected = contribution * (memberCount - 1);
        uint256 collected = rounds[currentRound].collected;

        if (block.timestamp < roundEnd && collected < expected) revert RoundNotReady();

        address recipient = order[currentRound - 1];
        uint256 shortfall = expected - collected;

        rounds[currentRound].closed = true;

        for (uint256 i = 0; i < order.length; i++) {
            address member = order[i];
            if (member == recipient) continue;
            if (!hasContributed[currentRound][member]) {
                debts[member][recipient] += contribution;
            }
        }

        claimable[recipient] += collected;

        emit RoundClosed(currentRound, recipient, collected, shortfall);

        if (currentRound == memberCount) {
            state = State.Completed;
        } else {
            currentRound++;
            roundEnd = uint64(block.timestamp) + roundDuration;
        }
    }

    /// @notice Claim an unclaimed payout.
    function claim() external circleStarted {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();

        claimable[msg.sender] = 0;

        emit Claimed(msg.sender, amount);

        IERC20(token).safeTransfer(msg.sender, amount);
    }

    /// @notice Repay a debt owed to a shorted recipient.
    function repay() external circleStarted {
        revert NotImplemented();
    }
}
