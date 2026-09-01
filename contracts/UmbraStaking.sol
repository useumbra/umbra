// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IERC20 {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(address from, address to, uint256 amount)
        external
        returns (bool);
}

/// @title UmbraStaking
/// @notice Single-token staking for $UMBRA. Stakers keep custody of their
///         principal at all times and earn from a reward pool the owner funds
///         up front; the contract never mints and never takes a fee.
/// @dev Stake token and reward token are the same ERC20, so rewards are only
///      ever paid from `balanceOf(this) - totalStaked`.
contract UmbraStaking {
    IERC20 public immutable token;

    address public owner;
    address public pendingOwner;

    uint256 public totalStaked;
    uint256 public rewardRate;
    uint256 public periodFinish;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public rewardsCommitted;
    uint256 public rewardsSettled;

    mapping(address => uint256) public stakedOf;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private locked = 1;

    event Staked(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event RewardPaid(address indexed account, uint256 amount);
    event RewardAdded(uint256 amount, uint256 duration, uint256 periodFinish);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotPendingOwner();
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientStake();
    error InsufficientRewardBalance();
    error InvalidDuration();
    error RewardPeriodActive();
    error TransferFailed();
    error Reentrancy();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    constructor(address stakingToken, address initialOwner) {
        if (stakingToken == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        token = IERC20(stakingToken);
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    /// @notice Reward accrual stops when the funded period ends.
    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored
            + ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18)
                / totalStaked;
    }

    function earned(address account) public view returns (uint256) {
        return (
            stakedOf[account]
                * (rewardPerToken() - userRewardPerTokenPaid[account])
        ) / 1e18 + rewards[account];
    }

    /// @notice Reward tokens held by this contract that are not staked principal.
    function rewardPool() public view returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        return balance > totalStaked ? balance - totalStaked : 0;
    }

    /// @notice Funded rewards that are still owed to stakers, whether already
    ///         accrued or still streaming until `periodFinish`.
    function outstandingRewards() public view returns (uint256) {
        return rewardsCommitted > rewardsSettled
            ? rewardsCommitted - rewardsSettled
            : 0;
    }

    function stake(uint256 amount)
        external
        nonReentrant
        updateReward(msg.sender)
    {
        if (amount == 0) revert ZeroAmount();
        uint256 before = token.balanceOf(address(this));
        _safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();
        totalStaked += received;
        stakedOf[msg.sender] += received;
        emit Staked(msg.sender, received);
    }

    function withdraw(uint256 amount)
        public
        nonReentrant
        updateReward(msg.sender)
    {
        if (amount == 0) revert ZeroAmount();
        if (stakedOf[msg.sender] < amount) revert InsufficientStake();
        stakedOf[msg.sender] -= amount;
        totalStaked -= amount;
        _safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward == 0) return;
        uint256 available = rewardPool();
        if (available < reward) revert InsufficientRewardBalance();
        rewards[msg.sender] = 0;
        rewardsSettled += reward;
        _safeTransfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
    }

    /// @notice Withdraw the full stake and any accrued reward in one call.
    function exit() external {
        uint256 staked = stakedOf[msg.sender];
        if (staked > 0) withdraw(staked);
        getReward();
    }

    /// @notice Withdraw principal only, ignoring rewards. Always available,
    ///         even if the reward pool is empty or accounting is stuck.
    function emergencyWithdraw()
        external
        nonReentrant
        updateReward(msg.sender)
    {
        uint256 staked = stakedOf[msg.sender];
        if (staked == 0) revert InsufficientStake();
        uint256 forfeited = rewards[msg.sender];
        stakedOf[msg.sender] = 0;
        totalStaked -= staked;
        rewards[msg.sender] = 0;
        rewardsSettled += forfeited;
        _safeTransfer(msg.sender, staked);
        emit Withdrawn(msg.sender, staked);
    }

    /// @notice Fund a reward period. Tokens must already sit in the contract as
    ///         unstaked balance; the rate is derived from that pool so the
    ///         contract can never promise rewards it does not hold.
    function notifyRewardAmount(uint256 amount, uint256 duration)
        external
        onlyOwner
        updateReward(address(0))
    {
        if (amount == 0) revert ZeroAmount();
        if (duration == 0 || duration > 1460 days) revert InvalidDuration();
        uint256 leftover = block.timestamp < periodFinish
            ? (periodFinish - block.timestamp) * rewardRate
            : 0;
        if (rewardPool() < outstandingRewards() + amount) {
            revert InsufficientRewardBalance();
        }
        rewardRate = (amount + leftover) / duration;
        if (rewardRate == 0) revert ZeroAmount();
        rewardsCommitted += amount;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + duration;
        emit RewardAdded(amount, duration, periodFinish);
    }

    /// @notice Recover unallocated reward tokens once no period is running.
    ///         Staked principal can never be recovered by the owner.
    function recoverUnallocatedRewards(address to, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        if (to == address(0)) revert ZeroAddress();
        if (block.timestamp < periodFinish) revert RewardPeriodActive();
        if (amount == 0) revert ZeroAmount();
        if (rewardPool() < outstandingRewards() + amount) {
            revert InsufficientRewardBalance();
        }
        _safeTransfer(to, amount);
    }

    function transferOwnership(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        pendingOwner = to;
        emit OwnershipTransferStarted(owner, to);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        address previous = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(previous, owner);
    }

    function _safeTransfer(address to, uint256 amount) private {
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }

    function _safeTransferFrom(address from, address to, uint256 amount)
        private
    {
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeWithSelector(
                IERC20.transferFrom.selector, from, to, amount
            )
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }
}
