import type { Metadata } from "next";
import { chainNetworks } from "@/config/chain";
import { LockStakeClient } from "@/components/LockStakeClient";
import { StakeClient } from "@/components/StakeClient";

export const metadata: Metadata = {
  title: "Stake — Umbra",
  description: "Stake $UMBRA in the unaudited Umbra staking contract.",
};

export default function StakePage() {
  return chainNetworks.mainnet.lockStaking ? (
    <LockStakeClient />
  ) : (
    <StakeClient />
  );
}
