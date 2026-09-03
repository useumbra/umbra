import type { Metadata } from "next";
import { StakeClient } from "@/components/StakeClient";

export const metadata: Metadata = {
  title: "Flexible staking — Umbra",
  description: "Stake $UMBRA in the unaudited Umbra flexible staking contract.",
};

export default function FlexibleStakePage() {
  return <StakeClient />;
}
