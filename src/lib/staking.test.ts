import { describe, expect, it, vi } from "vitest";
import {
  ALLOWANCE_SELECTOR,
  APPROVE_SELECTOR,
  EARNED_SELECTOR,
  EMERGENCY_WITHDRAW_SELECTOR,
  EXIT_SELECTOR,
  GET_REWARD_SELECTOR,
  PERIOD_FINISH_SELECTOR,
  REWARD_RATE_SELECTOR,
  STAKED_OF_SELECTOR,
  STAKE_SELECTOR,
  TOTAL_STAKED_SELECTOR,
  WITHDRAW_SELECTOR,
  encodeAddressCall,
  encodeAllowance,
  encodeAmountCall,
  encodeApprove,
} from "./staking";
import { sendContractTx, WalletError, type Eip1193Provider } from "./wallet";

const address = "0x1111111111111111111111111111111111111111";
const spender = "0x2222222222222222222222222222222222222222";
const word = (value: string) => value.padStart(64, "0");

describe("staking helpers", () => {
  it("encodes every staking call selector and argument", () => {
    expect(encodeAmountCall(STAKE_SELECTOR, BigInt(1))).toBe(
      `0xa694fc3a${word("1")}`,
    );
    expect(encodeAmountCall(WITHDRAW_SELECTOR, BigInt(2))).toBe(
      `0x2e1a7d4d${word("2")}`,
    );
    expect(encodeAmountCall(GET_REWARD_SELECTOR, BigInt(3))).toBe(
      `0x3d18b912${word("3")}`,
    );
    expect(encodeAmountCall(EXIT_SELECTOR, BigInt(4))).toBe(
      `0xe9fad8ee${word("4")}`,
    );
    expect(encodeAmountCall(EMERGENCY_WITHDRAW_SELECTOR, BigInt(5))).toBe(
      `0xdb2e21bc${word("5")}`,
    );
    expect(encodeAddressCall(STAKED_OF_SELECTOR, address)).toBe(
      `0xaf500ba3${word("11".repeat(20))}`,
    );
    expect(encodeAddressCall(EARNED_SELECTOR, address)).toBe(
      `0x008cc262${word("11".repeat(20))}`,
    );
    expect(encodeAmountCall(TOTAL_STAKED_SELECTOR, BigInt(0))).toBe(
      `0x817b1cd2${word("0")}`,
    );
    expect(encodeAmountCall(PERIOD_FINISH_SELECTOR, BigInt(0))).toBe(
      `0xebe2b12b${word("0")}`,
    );
    expect(encodeAmountCall(REWARD_RATE_SELECTOR, BigInt(0))).toBe(
      `0x7b0a47ee${word("0")}`,
    );
    expect(encodeApprove(spender, BigInt(6))).toBe(
      `${APPROVE_SELECTOR}${word("22".repeat(20))}${word("6")}`,
    );
    expect(encodeAllowance(address, spender)).toBe(
      `${ALLOWANCE_SELECTOR}${word("11".repeat(20))}${word("22".repeat(20))}`,
    );
  });

  it("rejects invalid addresses, negative amounts, and oversized amounts", () => {
    expect(() => encodeAddressCall(STAKED_OF_SELECTOR, "nope")).toThrow();
    expect(() => encodeApprove("0x1234", BigInt(1))).toThrow();
    expect(() => encodeAllowance(address, "0x1234")).toThrow();
    expect(() => encodeAmountCall(STAKE_SELECTOR, -BigInt(1))).toThrow(
      /negative/,
    );
    expect(() =>
      encodeAmountCall(STAKE_SELECTOR, BigInt(2) ** BigInt(256)),
    ).toThrow(/large/);
  });

  it("maps contract transaction wallet errors", async () => {
    const rejected: Eip1193Provider = {
      request: vi.fn(async (args) => {
        if (args.method === "eth_sendTransaction") throw { code: 4001 };
        return null;
      }),
    };
    await expect(
      sendContractTx(rejected, {
        from: address,
        to: spender,
        data: STAKE_SELECTOR,
        rejectedMessage: "Stake rejected.",
      }),
    ).rejects.toEqual(new WalletError("USER_REJECTED", "Stake rejected."));

    const missingHash: Eip1193Provider = {
      request: vi.fn(async () => null),
    };
    await expect(
      sendContractTx(missingHash, {
        from: address,
        to: spender,
        data: STAKE_SELECTOR,
        rejectedMessage: "Stake rejected.",
      }),
    ).rejects.toMatchObject({
      code: "RPC_ERROR",
      message: "The wallet did not return a transaction hash.",
    });
  });
});
