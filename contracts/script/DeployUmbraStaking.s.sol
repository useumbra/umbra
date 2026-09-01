// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {UmbraStaking} from "../UmbraStaking.sol";

contract DeployUmbraStaking is Script {
    function run() external returns (UmbraStaking staking) {
        address token = vm.envAddress("UMBRA_TOKEN");
        address owner = vm.envAddress("STAKING_OWNER");
        vm.startBroadcast();
        staking = new UmbraStaking(token, owner);
        vm.stopBroadcast();
    }
}
