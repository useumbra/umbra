// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract MockERC20 {
    string public constant name = "Mock UMBRA";
    string public constant symbol = "mUMBRA";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    uint256 public feeBps;
    bool public returnsFalse;
    address public callbackTarget;
    bytes public callbackData;
    bool public callbackEnabled;
    bytes4 public callbackErrorSelector;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    constructor(uint256 initialSupply) {
        _mint(msg.sender, initialSupply);
    }

    function setFeeBps(uint256 value) external {
        require(value <= 10_000, "fee too high");
        feeBps = value;
    }

    function setReturnsFalse(bool value) external {
        returnsFalse = value;
    }

    function setReentrantCall(address target, bytes calldata data) external {
        callbackTarget = target;
        callbackData = data;
        callbackEnabled = true;
        callbackErrorSelector = bytes4(0);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (returnsFalse) return false;
        _callback();
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
        external
        returns (bool)
    {
        if (returnsFalse) return false;
        uint256 approved = allowance[from][msg.sender];
        require(approved >= amount, "allowance");
        allowance[from][msg.sender] = approved - amount;
        _callback();
        _move(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        uint256 fee = amount * feeBps / 10_000;
        balanceOf[from] -= amount;
        balanceOf[to] += amount - fee;
        totalSupply -= fee;
        emit Transfer(from, to, amount - fee);
    }

    function _callback() internal {
        if (!callbackEnabled) return;
        callbackEnabled = false;
        (bool ok, bytes memory data) = callbackTarget.call(callbackData);
        if (!ok && data.length >= 4) {
            callbackErrorSelector = bytes4(data);
        }
    }
}
