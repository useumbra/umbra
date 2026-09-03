// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {UmbraLockStaking} from "../UmbraLockStaking.sol";

contract UmbraLockStakingTest is Test {
    uint256 internal constant UNIT = 1e18;
    uint256 internal constant THIRTY_DAYS = 30 days;

    MockERC20 internal token;
    UmbraLockStaking internal staking;
    address internal owner = address(0xA11CE);
    address internal alice = address(0xA1);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA);

    function setUp() public {
        token = new MockERC20(0);
        staking = new UmbraLockStaking(address(token), owner, _tiers());
        token.mint(owner, 1_000_000 * UNIT);
        token.mint(alice, 200_000 * UNIT);
        token.mint(bob, 100_000 * UNIT);
        token.mint(carol, 100_000 * UNIT);
        vm.prank(owner);
        token.approve(address(staking), type(uint256).max);
        vm.prank(alice);
        token.approve(address(staking), type(uint256).max);
        vm.prank(bob);
        token.approve(address(staking), type(uint256).max);
        vm.prank(carol);
        token.approve(address(staking), type(uint256).max);
    }

    function testConstructorRejectsInvalidInputs() public {
        vm.expectRevert(UmbraLockStaking.ZeroAddress.selector);
        new UmbraLockStaking(address(0), owner, _tiers());
        vm.expectRevert(UmbraLockStaking.ZeroAddress.selector);
        new UmbraLockStaking(address(token), address(0), _tiers());

        UmbraLockStaking.Tier[] memory empty;
        vm.expectRevert(UmbraLockStaking.InvalidTier.selector);
        new UmbraLockStaking(address(token), owner, empty);

        UmbraLockStaking.Tier[] memory invalidDuration = _tiers();
        invalidDuration[0].duration = 0;
        vm.expectRevert(UmbraLockStaking.InvalidTier.selector);
        new UmbraLockStaking(address(token), owner, invalidDuration);

        UmbraLockStaking.Tier[] memory invalidApr = _tiers();
        invalidApr[0].aprBps = 0;
        vm.expectRevert(UmbraLockStaking.InvalidTier.selector);
        new UmbraLockStaking(address(token), owner, invalidApr);

        assertEq(staking.tierCount(), 3);
        assertEq(staking.nextPositionId(), 1);
    }

    function testQuoteRewardUsesExactTierMath() public view {
        uint256 amount = 100_000 * UNIT;
        uint256 expected = amount * 4_000 * THIRTY_DAYS
            / (10_000 * 365 days);
        assertEq(staking.quoteReward(amount, 0), expected);
    }

    function testStakeRequiresRewardFundingAndSucceedsAtExactBalance()
        public
    {
        uint256 amount = 100_000 * UNIT;
        uint256 reward = staking.quoteReward(amount, 0);
        vm.prank(alice);
        vm.expectRevert(UmbraLockStaking.InsufficientRewardBalance.selector);
        staking.stake(amount, 0);

        _fund(reward);
        vm.prank(alice);
        uint256 id = staking.stake(amount, 0);
        assertEq(id, 1);
        assertEq(staking.totalStaked(), amount);
        assertEq(staking.reservedRewards(), reward);
        assertEq(staking.availableRewards(), 0);
    }

    function testStakeReservesRewardsAndSecondStakeCannotExceedPool()
        public
    {
        uint256 amount = 100_000 * UNIT;
        uint256 reward = staking.quoteReward(amount, 0);
        _fund(reward + reward / 2);

        vm.prank(alice);
        staking.stake(amount, 0);
        assertEq(staking.availableRewards(), reward / 2);

        vm.prank(bob);
        vm.expectRevert(UmbraLockStaking.InsufficientRewardBalance.selector);
        staking.stake(amount, 0);
        assertEq(staking.reservedRewards(), reward);
    }

    function testWithdrawStaysLockedThenPaysPrincipalAndReward() public {
        uint256 amount = 100_000 * UNIT;
        uint256 reward = staking.quoteReward(amount, 0);
        _fund(reward);
        vm.prank(alice);
        uint256 id = staking.stake(amount, 0);

        vm.prank(alice);
        vm.expectRevert(UmbraLockStaking.StillLocked.selector);
        staking.withdraw(id);

        uint256 before = token.balanceOf(alice);
        vm.warp(block.timestamp + THIRTY_DAYS);
        vm.prank(alice);
        staking.withdraw(id);
        assertEq(token.balanceOf(alice), before + amount + reward);
        assertEq(staking.totalStaked(), 0);
        assertEq(staking.reservedRewards(), 0);
        assertTrue(_positionClosed(id));

        vm.prank(alice);
        vm.expectRevert(UmbraLockStaking.PositionClosed.selector);
        staking.withdraw(id);
    }

    function testEmergencyWithdrawReturnsPrincipalAndUnreservesReward()
        public
    {
        uint256 amount = 100_000 * UNIT;
        uint256 reward = staking.quoteReward(amount, 0);
        _fund(reward);
        vm.prank(alice);
        uint256 id = staking.stake(amount, 0);
        uint256 before = token.balanceOf(alice);

        vm.prank(alice);
        staking.emergencyWithdraw(id);
        assertEq(token.balanceOf(alice), before + amount);
        assertEq(staking.availableRewards(), reward);
        assertEq(staking.reservedRewards(), 0);
        assertTrue(_positionClosed(id));
    }

    function testOnlyPositionOwnerCanWithdraw() public {
        uint256 amount = 100_000 * UNIT;
        _fund(staking.quoteReward(amount, 0));
        vm.prank(alice);
        uint256 id = staking.stake(amount, 0);
        vm.warp(block.timestamp + THIRTY_DAYS);

        vm.prank(bob);
        vm.expectRevert(UmbraLockStaking.NotPositionOwner.selector);
        staking.withdraw(id);
    }

    function testRecoverCannotTouchPrincipalOrReservedReward() public {
        uint256 amount = 100_000 * UNIT;
        uint256 reward = staking.quoteReward(amount, 0);
        _fund(reward + 100);
        vm.prank(alice);
        staking.stake(amount, 0);
        assertEq(staking.availableRewards(), 100);

        vm.prank(owner);
        vm.expectRevert(UmbraLockStaking.InsufficientRewardBalance.selector);
        staking.recoverUnreservedRewards(owner, 101);

        uint256 before = token.balanceOf(carol);
        vm.prank(owner);
        staking.recoverUnreservedRewards(carol, 100);
        assertEq(token.balanceOf(carol), before + 100);
        assertEq(staking.availableRewards(), 0);
    }

    function testPauseBlocksStakeButNotWithdraw() public {
        uint256 amount = 100_000 * UNIT;
        uint256 reward = staking.quoteReward(amount, 0);
        _fund(reward * 2);
        vm.prank(owner);
        staking.setStakingPaused(true);
        vm.prank(alice);
        vm.expectRevert(UmbraLockStaking.StakingPaused.selector);
        staking.stake(amount, 0);

        vm.prank(owner);
        staking.setStakingPaused(false);
        vm.prank(alice);
        uint256 id = staking.stake(amount, 0);
        vm.prank(owner);
        staking.setStakingPaused(true);
        vm.warp(block.timestamp + THIRTY_DAYS);
        vm.prank(alice);
        staking.withdraw(id);
        assertEq(staking.totalStaked(), 0);
    }

    function testFeeOnTransferCreditsReceivedAndQuotesOnReceived()
        public
    {
        uint256 requested = 100 * UNIT;
        uint256 received = 95 * UNIT;
        uint256 reward = staking.quoteReward(received, 0);
        _fund(reward);
        token.setFeeBps(500);

        vm.prank(alice);
        uint256 id = staking.stake(requested, 0);
        (uint128 positionAmount, uint128 positionReward,,,,) =
            staking.positions(id);
        assertEq(positionAmount, received);
        assertEq(positionReward, reward);
    }

    function testFalseReturningTokenRevertsTransferFailed() public {
        token.setReturnsFalse(true);
        vm.prank(alice);
        vm.expectRevert(UmbraLockStaking.TransferFailed.selector);
        staking.stake(UNIT, 0);
    }

    function testWithdrawRejectsReentrantTokenCallback() public {
        uint256 amount = 100_000 * UNIT;
        _fund(staking.quoteReward(amount, 0));
        vm.prank(alice);
        uint256 id = staking.stake(amount, 0);
        vm.warp(block.timestamp + THIRTY_DAYS);
        token.setReentrantCall(
            address(staking),
            abi.encodeWithSelector(UmbraLockStaking.withdraw.selector, id)
        );

        vm.prank(alice);
        staking.withdraw(id);
        assertEq(
            token.callbackErrorSelector(),
            UmbraLockStaking.Reentrancy.selector
        );
        assertTrue(_positionClosed(id));
    }

    function testTwoStepOwnership() public {
        vm.prank(owner);
        staking.transferOwnership(bob);
        assertEq(staking.pendingOwner(), bob);
        vm.prank(alice);
        vm.expectRevert(UmbraLockStaking.NotPendingOwner.selector);
        staking.acceptOwnership();
        vm.prank(bob);
        staking.acceptOwnership();
        assertEq(staking.owner(), bob);
        assertEq(staking.pendingOwner(), address(0));
    }

    function testWithdrawAllSkipsLockedPositions() public {
        uint256 firstAmount = 100_000 * UNIT;
        uint256 secondAmount = 50_000 * UNIT;
        _fund(
            staking.quoteReward(firstAmount, 0)
                + staking.quoteReward(secondAmount, 1)
        );
        vm.startPrank(alice);
        uint256 firstId = staking.stake(firstAmount, 0);
        uint256 secondId = staking.stake(secondAmount, 1);
        vm.stopPrank();

        vm.warp(block.timestamp + THIRTY_DAYS);
        vm.prank(alice);
        staking.withdrawAll();
        assertTrue(_positionClosed(firstId));
        assertFalse(_positionClosed(secondId));
        assertEq(staking.totalStaked(), secondAmount);

        vm.warp(block.timestamp + 60 days);
        vm.prank(alice);
        staking.withdrawAll();
        assertTrue(_positionClosed(secondId));
        assertEq(staking.totalStaked(), 0);
    }

    function testStakeRejectsInvalidTier() public {
        vm.prank(alice);
        vm.expectRevert(UmbraLockStaking.InvalidTier.selector);
        staking.stake(UNIT, 3);
    }

    function _fund(uint256 amount) internal {
        vm.prank(owner);
        staking.fundRewards(amount);
    }

    function _positionClosed(uint256 id) internal view returns (bool closed) {
        (,,,,, closed) = staking.positions(id);
    }

    function _tiers()
        internal
        pure
        returns (UmbraLockStaking.Tier[] memory definitions)
    {
        definitions = new UmbraLockStaking.Tier[](3);
        definitions[0] = UmbraLockStaking.Tier({
            duration: uint32(30 days),
            aprBps: 4_000
        });
        definitions[1] = UmbraLockStaking.Tier({
            duration: uint32(90 days),
            aprBps: 8_000
        });
        definitions[2] = UmbraLockStaking.Tier({
            duration: uint32(180 days),
            aprBps: 15_000
        });
    }
}
