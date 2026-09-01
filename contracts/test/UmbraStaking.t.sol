// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {UmbraStaking} from "../UmbraStaking.sol";

contract UmbraStakingTest is Test {
    uint256 internal constant UNIT = 1e18;
    uint256 internal constant PERIOD = 1000;

    MockERC20 internal token;
    UmbraStaking internal staking;
    address internal owner = address(0xA11CE);
    address internal alice = address(0xA1);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA);

    function setUp() public {
        token = new MockERC20(1_000_000 * UNIT);
        staking = new UmbraStaking(address(token), owner);
        token.mint(owner, 1_000_000 * UNIT);
        token.mint(alice, 100_000 * UNIT);
        token.mint(bob, 100_000 * UNIT);
        token.mint(carol, 100_000 * UNIT);
        vm.prank(alice);
        token.approve(address(staking), type(uint256).max);
        vm.prank(bob);
        token.approve(address(staking), type(uint256).max);
        vm.prank(carol);
        token.approve(address(staking), type(uint256).max);
    }

    function testConstructorRejectsZeroAddressesAndSetsState() public {
        vm.expectRevert(UmbraStaking.ZeroAddress.selector);
        new UmbraStaking(address(0), owner);
        vm.expectRevert(UmbraStaking.ZeroAddress.selector);
        new UmbraStaking(address(token), address(0));
        assertEq(address(staking.token()), address(token));
        assertEq(staking.owner(), owner);
    }

    function testStakeValidatesApprovalAndAmountAndEmits() public {
        vm.prank(alice);
        vm.expectRevert(UmbraStaking.ZeroAmount.selector);
        staking.stake(0);

        address unapproved = address(0xF00);
        token.mint(unapproved, UNIT);
        vm.prank(unapproved);
        vm.expectRevert(UmbraStaking.TransferFailed.selector);
        staking.stake(UNIT);

        vm.expectEmit(true, false, false, true);
        emit UmbraStaking.Staked(alice, 10 * UNIT);
        vm.prank(alice);
        staking.stake(10 * UNIT);
        assertEq(staking.stakedOf(alice), 10 * UNIT);
        assertEq(staking.totalStaked(), 10 * UNIT);
    }

    function testFeeOnTransferStakeCreditsReceivedAndWithdraws() public {
        token.setFeeBps(500);
        uint256 requested = 100 * UNIT;
        uint256 received = 95 * UNIT;
        vm.prank(alice);
        staking.stake(requested);
        assertEq(staking.stakedOf(alice), received);
        assertEq(staking.totalStaked(), received);
        vm.prank(alice);
        staking.withdraw(received);
        assertEq(staking.stakedOf(alice), 0);
        assertEq(staking.totalStaked(), 0);
    }

    function testFalseTransferRevertsTransferFailed() public {
        vm.prank(alice);
        staking.stake(10 * UNIT);
        token.setReturnsFalse(true);
        vm.prank(alice);
        vm.expectRevert(UmbraStaking.TransferFailed.selector);
        staking.withdraw(UNIT);
    }

    function testWithdrawChecksBalanceAndEmitsPartialAmount() public {
        vm.prank(alice);
        staking.stake(10 * UNIT);
        vm.prank(alice);
        vm.expectRevert(UmbraStaking.InsufficientStake.selector);
        staking.withdraw(11 * UNIT);
        vm.expectEmit(true, false, false, true);
        emit UmbraStaking.Withdrawn(alice, 4 * UNIT);
        vm.prank(alice);
        staking.withdraw(4 * UNIT);
        assertEq(staking.stakedOf(alice), 6 * UNIT);
    }

    function testNotifyRewardAmountValidatesOwnerAmountDurationAndFunding() public {
        vm.prank(alice);
        vm.expectRevert(UmbraStaking.NotOwner.selector);
        staking.notifyRewardAmount(UNIT, PERIOD);
        vm.prank(owner);
        vm.expectRevert(UmbraStaking.ZeroAmount.selector);
        staking.notifyRewardAmount(0, PERIOD);
        _fund(UNIT);
        vm.startPrank(owner);
        vm.expectRevert(UmbraStaking.InvalidDuration.selector);
        staking.notifyRewardAmount(UNIT, 0);
        vm.expectRevert(UmbraStaking.InvalidDuration.selector);
        staking.notifyRewardAmount(UNIT, 1461 days);
        vm.expectRevert(UmbraStaking.InsufficientRewardBalance.selector);
        staking.notifyRewardAmount(2 * UNIT, PERIOD);
        staking.notifyRewardAmount(UNIT, PERIOD);
        vm.stopPrank();
        assertEq(staking.rewardRate(), UNIT / PERIOD);
        assertEq(staking.periodFinish(), block.timestamp + PERIOD);
    }

    function testSingleStakerEarnsFundedPeriodAndNeverExceedsFunding() public {
        _fundAndNotify(1000 * UNIT, PERIOD);
        vm.prank(alice);
        staking.stake(100 * UNIT);
        vm.warp(block.timestamp + PERIOD);
        uint256 earned = staking.earned(alice);
        assertApproxEqAbs(earned, 1000 * UNIT, 1);
        assertLe(earned, 1000 * UNIT);
    }

    function testTwoStakersSplitByStakeTime() public {
        _fundAndNotify(1000 * UNIT, PERIOD);
        vm.prank(alice);
        staking.stake(100 * UNIT);
        vm.warp(block.timestamp + 500);
        vm.prank(bob);
        staking.stake(300 * UNIT);
        vm.warp(block.timestamp + 500);
        uint256 firstIntervalReward = 1000 * UNIT * 500 / 1000;
        uint256 secondIntervalReward = 1000 * UNIT * 500 / 1000;
        uint256 totalStakeDuringSecondInterval = 100 + 300;
        uint256 aliceExpected = firstIntervalReward
            + secondIntervalReward * 100 / totalStakeDuringSecondInterval;
        uint256 bobExpected =
            secondIntervalReward * 300 / totalStakeDuringSecondInterval;
        assertApproxEqAbs(staking.earned(alice), aliceExpected, 2);
        assertApproxEqAbs(staking.earned(bob), bobExpected, 2);
    }

    function testRewardsStopAtPeriodFinish() public {
        _fundAndNotify(1000 * UNIT, PERIOD);
        vm.prank(alice);
        staking.stake(100 * UNIT);
        vm.warp(block.timestamp + PERIOD);
        uint256 earned = staking.earned(alice);
        vm.warp(block.timestamp + 10_000);
        assertEq(staking.earned(alice), earned);
    }

    function testPrincipalIsExcludedFromRewardPoolAndClaimsDoNotTouchIt() public {
        _fundAndNotify(1000 * UNIT, PERIOD);
        vm.prank(alice);
        staking.stake(100 * UNIT);
        vm.prank(bob);
        staking.stake(10_000 * UNIT);
        assertEq(staking.rewardPool(), 1000 * UNIT);
        vm.warp(block.timestamp + PERIOD);
        vm.prank(alice);
        staking.getReward();
        assertGe(token.balanceOf(address(staking)), staking.totalStaked());
        vm.prank(bob);
        staking.getReward();
        assertGe(token.balanceOf(address(staking)), staking.totalStaked());
    }

    function testZeroRewardNoOpAndExitWithdrawsPrincipalAndReward() public {
        uint256 beforeBalance = token.balanceOf(alice);
        vm.prank(alice);
        staking.getReward();
        assertEq(token.balanceOf(alice), beforeBalance);

        _fundAndNotify(1000 * UNIT, PERIOD);
        vm.prank(alice);
        staking.stake(100 * UNIT);
        vm.warp(block.timestamp + PERIOD);
        uint256 expectedReward = staking.earned(alice);
        vm.prank(alice);
        staking.exit();
        assertEq(staking.stakedOf(alice), 0);
        assertEq(token.balanceOf(alice), beforeBalance + expectedReward);
    }

    function testEmergencyWithdrawForfeitsOnlyCallerRewardAndPreservesOtherAccrual() public {
        _fundAndNotify(1000 * UNIT, PERIOD);
        vm.prank(alice);
        staking.stake(100 * UNIT);
        vm.prank(bob);
        staking.stake(100 * UNIT);
        vm.warp(block.timestamp + 500);
        uint256 bobBefore = staking.earned(bob);
        uint256 aliceForfeited = staking.earned(alice);
        vm.prank(alice);
        staking.emergencyWithdraw();
        assertEq(staking.rewardsSettled(), aliceForfeited);
        assertEq(staking.stakedOf(alice), 0);
        assertEq(staking.earned(bob), bobBefore);
    }

    function testNotifyMidPeriodRollsLeftoverAndRequiresFunding() public {
        _fundAndNotify(1000 * UNIT, PERIOD);
        vm.warp(block.timestamp + 400);
        _fund(500 * UNIT);
        vm.prank(owner);
        staking.notifyRewardAmount(500 * UNIT, PERIOD);
        assertEq(staking.rewardRate(), 11 * UNIT / 10);
        assertEq(staking.rewardsCommitted(), 1500 * UNIT);
    }

    function testRecoverUnallocatedRewardsRules() public {
        _fundAndNotify(100 * UNIT, PERIOD);
        vm.prank(owner);
        vm.expectRevert(UmbraStaking.RewardPeriodActive.selector);
        staking.recoverUnallocatedRewards(owner, UNIT);
        vm.warp(block.timestamp + PERIOD);
        _fund(50 * UNIT);
        vm.prank(owner);
        staking.recoverUnallocatedRewards(owner, 50 * UNIT);
        vm.prank(alice);
        vm.expectRevert(UmbraStaking.InsufficientStake.selector);
        staking.emergencyWithdraw();
        vm.prank(alice);
        vm.expectRevert(UmbraStaking.InsufficientStake.selector);
        staking.withdraw(UNIT);
        vm.prank(alice);
        vm.expectRevert(UmbraStaking.NotOwner.selector);
        staking.recoverUnallocatedRewards(alice, UNIT);
    }

    function testRecoverCannotTouchStakedPrincipal() public {
        vm.prank(alice);
        staking.stake(100 * UNIT);
        vm.prank(owner);
        vm.expectRevert(UmbraStaking.InsufficientRewardBalance.selector);
        staking.recoverUnallocatedRewards(owner, UNIT);
    }

    function testTwoStepOwnership() public {
        vm.prank(owner);
        staking.transferOwnership(alice);
        assertEq(staking.owner(), owner);
        assertEq(staking.pendingOwner(), alice);
        vm.prank(bob);
        vm.expectRevert(UmbraStaking.NotPendingOwner.selector);
        staking.acceptOwnership();
        vm.prank(alice);
        staking.acceptOwnership();
        assertEq(staking.owner(), alice);
        assertEq(staking.pendingOwner(), address(0));
    }

    function testReentrantTokenCallbackHitsReentrancyGuard() public {
        vm.prank(alice);
        staking.stake(10 * UNIT);
        token.setReentrantCall(
            address(staking), abi.encodeCall(staking.withdraw, (UNIT))
        );
        vm.prank(alice);
        staking.withdraw(UNIT);
        assertEq(
            token.callbackErrorSelector(),
            UmbraStaking.Reentrancy.selector
        );
    }

    function testRecoverCannotStealAccruedRewardsAndClaimStillSucceeds() public {
        _fundAndNotify(100 * UNIT, PERIOD);
        vm.prank(alice);
        staking.stake(100 * UNIT);
        vm.warp(block.timestamp + PERIOD);
        vm.prank(owner);
        vm.expectRevert(UmbraStaking.InsufficientRewardBalance.selector);
        staking.recoverUnallocatedRewards(owner, 100 * UNIT);
        uint256 earned = staking.earned(alice);
        vm.prank(alice);
        staking.getReward();
        assertApproxEqAbs(earned, 100 * UNIT, 1);
        assertEq(staking.outstandingRewards(), 0);
    }

    function testRecoverDustCannotPullPrincipal() public {
        _fundAndNotify(101, 100);
        vm.prank(alice);
        staking.stake(100 * UNIT);
        vm.warp(block.timestamp + 100);
        vm.prank(alice);
        staking.getReward();
        assertEq(staking.outstandingRewards(), 1);
        vm.prank(owner);
        vm.expectRevert(UmbraStaking.InsufficientRewardBalance.selector);
        staking.recoverUnallocatedRewards(owner, 1);
        vm.prank(owner);
        vm.expectRevert(UmbraStaking.InsufficientRewardBalance.selector);
        staking.recoverUnallocatedRewards(owner, UNIT);
        assertEq(token.balanceOf(address(staking)), 100 * UNIT + 1);
        assertEq(staking.totalStaked(), 100 * UNIT);
    }

    function testForfeitedRewardCanBeRecovered() public {
        _fundAndNotify(100 * UNIT, PERIOD);
        vm.prank(alice);
        staking.stake(100 * UNIT);
        vm.warp(block.timestamp + PERIOD);
        vm.prank(alice);
        staking.emergencyWithdraw();
        assertEq(staking.rewardsSettled(), 100 * UNIT);
        vm.prank(owner);
        staking.recoverUnallocatedRewards(owner, 100 * UNIT);
        assertEq(staking.rewardPool(), 0);
    }

    function testActiveNotifyRequiresOutstandingPlusAmount() public {
        _fundAndNotify(100 * UNIT, PERIOD);
        _fund(50 * UNIT - 1);
        vm.prank(owner);
        vm.expectRevert(UmbraStaking.InsufficientRewardBalance.selector);
        staking.notifyRewardAmount(50 * UNIT, PERIOD);
        _fund(1);
        vm.prank(owner);
        staking.notifyRewardAmount(50 * UNIT, PERIOD);
        assertEq(staking.rewardsCommitted(), 150 * UNIT);
    }

    function testFuzz_StakeWithdrawInvariants(uint96 first, uint96 second, uint96 withdrawal)
        public
    {
        uint256 a = bound(uint256(first), 1, 1000 * UNIT);
        uint256 b = bound(uint256(second), 1, 1000 * UNIT);
        uint256 c = bound(uint256(withdrawal), 1, a + b);
        vm.prank(alice);
        staking.stake(a);
        _assertInvariant();
        vm.prank(bob);
        staking.stake(b);
        _assertInvariant();
        if (c <= a) {
            vm.prank(alice);
            staking.withdraw(c);
        } else {
            vm.prank(alice);
            staking.withdraw(a);
            vm.prank(bob);
            staking.withdraw(c - a);
        }
        _assertInvariant();
    }

    function _fund(uint256 amount) internal {
        vm.prank(owner);
        token.transfer(address(staking), amount);
    }

    function _fundAndNotify(uint256 amount, uint256 duration) internal {
        _fund(amount);
        vm.prank(owner);
        staking.notifyRewardAmount(amount, duration);
    }

    function _assertInvariant() internal view {
        assertEq(
            staking.stakedOf(alice)
                + staking.stakedOf(bob)
                + staking.stakedOf(carol),
            staking.totalStaked()
        );
        assertGe(token.balanceOf(address(staking)), staking.totalStaked());
    }
}
