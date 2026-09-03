// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(address from, address to, uint256 amount)
        external
        returns (bool);
}

/// @title UmbraLockStaking
/// @notice Fixed-term $UMBRA staking with owner-funded, fixed-APR rewards.
/// @dev Rewards are reserved when a position is opened and are never minted.
contract UmbraLockStaking {
    struct Tier {
        uint32 duration;
        uint16 aprBps;
    }

    struct Position {
        uint128 amount;
        uint128 reward;
        uint64 start;
        uint64 unlockAt;
        uint8 tier;
        bool closed;
    }

    IERC20 public immutable token;
    address public owner;
    address public pendingOwner;
    bool public stakingPaused;
    uint256 public totalStaked;
    uint256 public reservedRewards;
    uint256 public nextPositionId;

    mapping(uint256 => Position) public positions;
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256[]) private _positionsOf;
    Tier[] private _tiers;

    uint256 private locked = 1;

    event Staked(
        address indexed account,
        uint256 indexed id,
        uint256 amount,
        uint8 tierId,
        uint256 reward,
        uint256 unlockAt
    );
    event Withdrawn(
        address indexed account,
        uint256 indexed id,
        uint256 amount,
        uint256 reward
    );
    event EmergencyWithdrawn(
        address indexed account,
        uint256 indexed id,
        uint256 amount,
        uint256 forfeitedReward
    );
    event RewardsFunded(address indexed from, uint256 received);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotPendingOwner();
    error NotPositionOwner();
    error PositionClosed();
    error StillLocked();
    error StakingPaused();
    error InvalidTier();
    error ZeroAmount();
    error ZeroAddress();
    error AmountTooLarge();
    error InsufficientRewardBalance();
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

    constructor(
        address stakingToken,
        address initialOwner,
        Tier[] memory tierDefinitions
    ) {
        if (stakingToken == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        if (tierDefinitions.length == 0 || tierDefinitions.length > 8) {
            revert InvalidTier();
        }
        for (uint256 i; i < tierDefinitions.length; i++) {
            if (
                tierDefinitions[i].duration == 0
                    || tierDefinitions[i].aprBps == 0
            ) revert InvalidTier();
            _tiers.push(tierDefinitions[i]);
        }
        token = IERC20(stakingToken);
        owner = initialOwner;
        nextPositionId = 1;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function tierCount() external view returns (uint256) {
        return _tiers.length;
    }

    function tier(uint8 tierId) external view returns (Tier memory) {
        if (tierId >= _tiers.length) revert InvalidTier();
        return _tiers[tierId];
    }

    function tiers() external view returns (Tier[] memory) {
        return _tiers;
    }

    function tiers(uint256 tierId) external view returns (uint32, uint16) {
        if (tierId >= _tiers.length) revert InvalidTier();
        Tier memory selected = _tiers[tierId];
        return (selected.duration, selected.aprBps);
    }

    function quoteReward(uint256 amount, uint8 tierId)
        public
        view
        returns (uint256)
    {
        if (tierId >= _tiers.length) revert InvalidTier();
        Tier memory selected = _tiers[tierId];
        return amount * uint256(selected.aprBps) * uint256(selected.duration)
            / (10_000 * 365 days);
    }

    function availableRewards() public view returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        uint256 obligations = totalStaked + reservedRewards;
        return balance > obligations ? balance - obligations : 0;
    }

    function stake(uint256 amount, uint8 tierId)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (stakingPaused) revert StakingPaused();
        if (tierId >= _tiers.length) revert InvalidTier();
        if (amount == 0) revert ZeroAmount();

        uint256 beforeBalance = token.balanceOf(address(this));
        _safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - beforeBalance;
        if (received == 0) revert ZeroAmount();
        if (received > type(uint128).max) revert AmountTooLarge();

        uint256 reward = quoteReward(received, tierId);
        if (reward == 0) revert ZeroAmount();
        if (reward > type(uint128).max) revert AmountTooLarge();

        totalStaked += received;
        if (availableRewards() < reward) revert InsufficientRewardBalance();
        reservedRewards += reward;

        id = nextPositionId++;
        uint64 start = uint64(block.timestamp);
        uint64 unlockAt =
            uint64(block.timestamp + uint256(_tiers[tierId].duration));
        positions[id] = Position({
            amount: uint128(received),
            reward: uint128(reward),
            start: start,
            unlockAt: unlockAt,
            tier: tierId,
            closed: false
        });
        ownerOf[id] = msg.sender;
        _positionsOf[msg.sender].push(id);
        emit Staked(msg.sender, id, received, tierId, reward, unlockAt);
    }

    function withdraw(uint256 id) external nonReentrant {
        _withdrawPosition(id, msg.sender);
    }

    function emergencyWithdraw(uint256 id) external nonReentrant {
        address account = ownerOf[id];
        if (account != msg.sender) revert NotPositionOwner();
        Position storage position = positions[id];
        if (position.closed) revert PositionClosed();

        position.closed = true;
        totalStaked -= position.amount;
        reservedRewards -= position.reward;
        uint256 amount = position.amount;
        uint256 forfeitedReward = position.reward;
        _safeTransfer(msg.sender, amount);
        emit EmergencyWithdrawn(msg.sender, id, amount, forfeitedReward);
    }

    function withdrawAll() external nonReentrant {
        uint256[] storage ids = _positionsOf[msg.sender];
        for (uint256 i; i < ids.length; i++) {
            Position storage position = positions[ids[i]];
            if (!position.closed && block.timestamp >= position.unlockAt) {
                _withdrawPosition(ids[i], msg.sender);
            }
        }
    }

    function fundRewards(uint256 amount) external nonReentrant {
        uint256 beforeBalance = token.balanceOf(address(this));
        _safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - beforeBalance;
        emit RewardsFunded(msg.sender, received);
    }

    function recoverUnreservedRewards(address to, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        if (to == address(0)) revert ZeroAddress();
        if (amount > availableRewards()) revert InsufficientRewardBalance();
        _safeTransfer(to, amount);
    }

    function setStakingPaused(bool paused) external onlyOwner {
        stakingPaused = paused;
    }

    function positionsOf(address account)
        external
        view
        returns (uint256[] memory)
    {
        return _positionsOf[account];
    }

    function positionCount(address account) external view returns (uint256) {
        return _positionsOf[account].length;
    }

    function stakedOf(address account) public view returns (uint256 total) {
        uint256[] storage ids = _positionsOf[account];
        for (uint256 i; i < ids.length; i++) {
            Position memory position = positions[ids[i]];
            if (!position.closed) total += position.amount;
        }
    }

    function pendingRewardOf(address account)
        public
        view
        returns (uint256 total)
    {
        uint256[] storage ids = _positionsOf[account];
        for (uint256 i; i < ids.length; i++) {
            Position memory position = positions[ids[i]];
            if (!position.closed) total += position.reward;
        }
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

    function _withdrawPosition(uint256 id, address account) private {
        if (ownerOf[id] != account) revert NotPositionOwner();
        Position storage position = positions[id];
        if (position.closed) revert PositionClosed();
        if (block.timestamp < position.unlockAt) revert StillLocked();

        position.closed = true;
        totalStaked -= position.amount;
        reservedRewards -= position.reward;
        uint256 amount = position.amount;
        uint256 reward = position.reward;
        _safeTransfer(account, amount + reward);
        emit Withdrawn(account, id, amount, reward);
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
