import { describe, expect, it } from "vitest";
import {
  LOCK_STAKE_SELECTOR,
  decodeLockPosition,
  decodeLockPositionIds,
  decodeLockTiers,
  lockStake,
  maxStakeForTier,
  quoteReward,
  type LockTier,
} from "./lock-staking";
import { type Eip1193Provider } from "./wallet";

const word = (value: bigint | number) =>
  BigInt(value).toString(16).padStart(64, "0");

const dynamicArray = (values: string[]) =>
  `0x${word(32)}${word(values.length)}${values.join("")}`;

const tier = (
  id: number,
  durationSeconds: number,
  aprBps: number,
): LockTier => ({
  id,
  durationSeconds,
  aprBps,
});

describe("lock staking helpers", () => {
  it("decodes the dynamic tiers getter", () => {
    const encoded = dynamicArray([
      `${word(30 * 86_400)}${word(4_000)}`,
      `${word(90 * 86_400)}${word(8_000)}`,
      `${word(180 * 86_400)}${word(15_000)}`,
    ]);
    expect(decodeLockTiers(encoded)).toEqual([
      tier(0, 30 * 86_400, 4_000),
      tier(1, 90 * 86_400, 8_000),
      tier(2, 180 * 86_400, 15_000),
    ]);
  });

  it("decodes position IDs and position structs", () => {
    const ids = decodeLockPositionIds(dynamicArray([word(7), word(12)]));
    expect(ids).toEqual([BigInt(7), BigInt(12)]);
    expect(
      decodeLockPosition(
        BigInt(7),
        `0x${word(BigInt(100_000) * BigInt(10) ** BigInt(18))}${word(
          BigInt(3_287_671_232_876_712_328_767),
        )}${word(1_700_000_000)}${word(1_702_592_000)}${word(0)}${word(0)}`,
      ),
    ).toEqual({
      id: BigInt(7),
      amount: BigInt(100_000) * BigInt(10) ** BigInt(18),
      reward: BigInt(3_287_671_232_876_712_328_767),
      start: 1_700_000_000,
      unlockAt: 1_702_592_000,
      tier: 0,
      closed: false,
    });
  });

  it("matches the lock contract quote formula", () => {
    const amount = BigInt(100_000) * BigInt(10) ** BigInt(18);
    const selected = tier(0, 30 * 86_400, 4_000);
    expect(quoteReward(amount, selected)).toBe(
      (amount * BigInt(4_000) * BigInt(30 * 86_400)) /
        (BigInt(10_000) * BigInt(31_536_000)),
    );
  });

  it("round-trips the maximum stake through the reward quote", () => {
    const selected = tier(0, 30 * 86_400, 4_000);
    const amount = BigInt(100_000) * BigInt(10) ** BigInt(18);
    const available = quoteReward(amount, selected);
    const maximum = maxStakeForTier(available, selected);
    expect(maximum).toBe(
      (available * BigInt(10_000) * BigInt(31_536_000)) /
        (BigInt(4_000) * BigInt(30 * 86_400)),
    );
    expect(maximum).toBeLessThanOrEqual(amount);
    expect(quoteReward(maximum, selected)).toBeLessThanOrEqual(available);
  });

  it("uses the supplied stake selector and ABI words", async () => {
    let sentData = "";
    const provider: Eip1193Provider = {
      request: async (args) => {
        if (args.method === "eth_chainId") return "0x1237";
        if (args.method === "eth_sendTransaction") {
          sentData = String(
            (args.params?.[0] as { data?: string } | undefined)?.data,
          );
          return "0xhash";
        }
        return null;
      },
    };
    await lockStake(provider, {
      from: "0x1111111111111111111111111111111111111111",
      staking: "0x2222222222222222222222222222222222222222",
      amount: BigInt(1),
      tier: 2,
    });
    expect(sentData).toBe(
      `0x${LOCK_STAKE_SELECTOR.slice(2)}${word(1)}${word(2)}`,
    );
  });
});
