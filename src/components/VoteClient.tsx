"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadHolderProof, type StoredHolderProof } from "@/lib/holder-storage";
import { polls, voteWeight, type Poll } from "@/lib/holder-vote";
import { Header } from "./Header";
import styles from "./VoteClient.module.css";

type VoteTallyOption = {
  id: string;
  label: string;
  weight: number;
  voters: number;
};

type VoteTally = {
  pollId: string;
  options: VoteTallyOption[];
  totalWeight: number;
  totalVoters: number;
};

type VoteResponse = VoteTally & {
  choice?: unknown;
  weight?: unknown;
};

type HolderAccess = {
  tier: string;
  features: string[];
};

const emptyTally = (poll: Poll): VoteTally => ({
  pollId: poll.id,
  options: poll.options.map((option) => ({
    ...option,
    weight: 0,
    voters: 0,
  })),
  totalWeight: 0,
  totalVoters: 0,
});

const isTally = (value: unknown, poll: Poll): value is VoteTally => {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Partial<VoteTally>;
  return (
    data.pollId === poll.id &&
    Array.isArray(data.options) &&
    typeof data.totalWeight === "number" &&
    typeof data.totalVoters === "number"
  );
};

const readTally = async (poll: Poll): Promise<VoteTally> => {
  try {
    const response = await fetch(
      `/api/holder/vote?pollId=${encodeURIComponent(poll.id)}`,
    );
    const body = (await response.json().catch(() => undefined)) as unknown;
    return response.ok && isTally(body, poll) ? body : emptyTally(poll);
  } catch {
    return emptyTally(poll);
  }
};

export function VoteClient() {
  const [proof, setProof] = useState<StoredHolderProof>();
  const [access, setAccess] = useState<HolderAccess>({
    tier: "base",
    features: [],
  });
  const [tallies, setTallies] = useState<Record<string, VoteTally>>({});
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      const stored = loadHolderProof();
      if (active) setProof(stored);
      try {
        const response = await fetch("/api/holder/limits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stored ? { proof: stored.proof } : {}),
        });
        const body = (await response.json().catch(() => undefined)) as {
          tier?: unknown;
          features?: unknown;
        };
        if (
          active &&
          response.ok &&
          typeof body.tier === "string" &&
          Array.isArray(body.features) &&
          body.features.every((feature) => typeof feature === "string")
        )
          setAccess({ tier: body.tier, features: body.features });
      } catch {
        // A missing proof only means the page stays read-only.
      }
      const entries = await Promise.all(
        polls.map(async (poll) => [poll.id, await readTally(poll)] as const),
      );
      if (active) setTallies(Object.fromEntries(entries));
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const canVote = access.features.includes("vote");
  const personalWeight = useMemo(() => voteWeight(access.tier), [access.tier]);

  const castVote = async (poll: Poll, optionId: string) => {
    if (!proof || !canVote) return;
    setBusy((current) => ({ ...current, [poll.id]: true }));
    setError("");
    try {
      const response = await fetch("/api/holder/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proof: proof.proof,
          pollId: poll.id,
          optionId,
        }),
      });
      const body = (await response.json().catch(() => undefined)) as unknown;
      if (!response.ok || !isTally(body, poll))
        throw new Error(
          body &&
            typeof body === "object" &&
            "error" in body &&
            typeof body.error === "object" &&
            body.error !== null &&
            "message" in body.error &&
            typeof body.error.message === "string"
            ? body.error.message
            : "Could not record your vote.",
        );
      const vote = body as VoteResponse;
      setTallies((current) => ({ ...current, [poll.id]: vote }));
      const choice = vote.choice;
      if (typeof choice === "string")
        setChoices((current) => ({ ...current, [poll.id]: choice }));
      const weight = vote.weight;
      if (typeof weight === "number")
        setWeights((current) => ({ ...current, [poll.id]: weight }));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not record your vote.",
      );
    } finally {
      setBusy((current) => ({ ...current, [poll.id]: false }));
    }
  };

  return (
    <div>
      <Header />
      <main className={`shell ${styles.page}`}>
        <section className={styles.hero}>
          <div className="eyebrow">Holder vote</div>
          <h1>
            Shape what
            <br />
            <span>comes next.</span>
          </h1>
          <p>
            Public tallies show the advisory direction of verified $UMBRA
            holders. One wallet gets one vote per poll, weighted by tier.
          </p>
          {canVote ? (
            <p className={styles.access}>
              Your tier votes with weight {personalWeight}.
            </p>
          ) : (
            <p className={styles.note}>
              Verify a wallet holding at least 100,000 $UMBRA at{" "}
              <Link href="/credits">/credits</Link> to vote.
            </p>
          )}
        </section>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.polls}>
          {polls.map((poll) => {
            const tally = tallies[poll.id] ?? emptyTally(poll);
            return (
              <section className={`panel ${styles.card}`} key={poll.id}>
                <div className="eyebrow">Poll / {poll.id}</div>
                <h2>{poll.question}</h2>
                <p className={styles.meta}>
                  {tally.totalVoters} voters · {tally.totalWeight} total weight
                </p>
                <div className={styles.options}>
                  {poll.options.map((option) => {
                    const result = tally.options.find(
                      (candidate) => candidate.id === option.id,
                    );
                    const weight = result?.weight ?? 0;
                    const voters = result?.voters ?? 0;
                    const percentage =
                      tally.totalWeight > 0
                        ? Math.round((weight / tally.totalWeight) * 100)
                        : 0;
                    const selected = choices[poll.id] === option.id;
                    return (
                      <div className={styles.option} key={option.id}>
                        <button
                          type="button"
                          className={styles.optionButton}
                          onClick={() => void castVote(poll, option.id)}
                          disabled={!canVote || busy[poll.id]}
                        >
                          <span>{option.label}</span>
                          {selected && (
                            <strong className={styles.yourVote}>
                              Your vote
                            </strong>
                          )}
                        </button>
                        <div
                          className={styles.bar}
                          role="img"
                          aria-label={`${option.label}: ${percentage}%`}
                        >
                          <span style={{ width: `${percentage}%` }} />
                        </div>
                        <div className={styles.result}>
                          <span>{percentage}%</span>
                          <span>{voters} voters</span>
                          <span>{weight} weight</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {choices[poll.id] && (
                  <p className={styles.confirmation}>
                    Your vote is counted with weight{" "}
                    {weights[poll.id] ?? personalWeight}.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
