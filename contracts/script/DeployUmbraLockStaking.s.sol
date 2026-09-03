// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {UmbraLockStaking} from "../UmbraLockStaking.sol";

contract DeployUmbraLockStaking is Script {
    function run() external returns (UmbraLockStaking staking) {
        address token = vm.envAddress("UMBRA_TOKEN");
        address owner = vm.envAddress("STAKING_OWNER");
        UmbraLockStaking.Tier[] memory tierDefinitions =
            new UmbraLockStaking.Tier[](3);
        tierDefinitions[0] = UmbraLockStaking.Tier({
            duration: uint32(30 days),
            aprBps: 4_000
        });
        tierDefinitions[1] = UmbraLockStaking.Tier({
            duration: uint32(90 days),
            aprBps: 8_000
        });
        tierDefinitions[2] = UmbraLockStaking.Tier({
            duration: uint32(180 days),
            aprBps: 15_000
        });

        vm.startBroadcast();
        staking = new UmbraLockStaking(token, owner, tierDefinitions);
        vm.stopBroadcast();
    }
}
