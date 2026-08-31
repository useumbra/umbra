import type { Metadata } from "next";
import { VoteClient } from "@/components/VoteClient";

export const metadata: Metadata = {
  title: "Vote — Umbra",
  description: "Verified $UMBRA holders can weigh in on the Umbra roadmap.",
};

export default function VotePage() {
  return <VoteClient />;
}
