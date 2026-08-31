"use client";

import { useEffect, useState } from "react";
import { loadHolderProof, type StoredHolderProof } from "@/lib/holder-storage";
import { limitsForTier, type HolderLimits } from "@/lib/holder-limits";

type HolderLimitsState = {
  tier: string;
  limits: HolderLimits;
  proof: StoredHolderProof | undefined;
};

const baseState: HolderLimitsState = {
  tier: "base",
  limits: limitsForTier(),
  proof: undefined,
};

const isLimits = (value: unknown): value is HolderLimits =>
  typeof value === "object" &&
  value !== null &&
  "councilSeats" in value &&
  typeof value.councilSeats === "number" &&
  "chatMaxTokens" in value &&
  typeof value.chatMaxTokens === "number" &&
  "codeMaxTokens" in value &&
  typeof value.codeMaxTokens === "number";

export const useHolderLimits = (): HolderLimitsState => {
  const [state, setState] = useState(baseState);

  useEffect(() => {
    let cancelled = false;
    const stored = loadHolderProof();
    void fetch("/api/holder/limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stored ? { proof: stored.proof } : {}),
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => undefined)) as
          { tier?: string; limits?: unknown } | undefined;
        if (
          !response.ok ||
          typeof body?.tier !== "string" ||
          !isLimits(body.limits)
        )
          return;
        if (!cancelled)
          setState({
            tier: body.tier,
            limits: body.limits,
            proof: stored && body.tier === stored.tier ? stored : undefined,
          });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
