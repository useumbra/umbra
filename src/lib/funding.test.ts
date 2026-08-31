import { describe, expect, it } from "vitest";
import {
  creditsForUsdg,
  encodeErc20Transfer,
  findTransferToTreasury,
  parseAmount,
  TRANSFER_TOPIC,
  transferSender,
} from "./funding";

const token = "0x1111111111111111111111111111111111111111";
const treasury = "0x2222222222222222222222222222222222222222";
const recipientTopic = `0x${treasury.slice(2).padStart(64, "0")}`;

describe("USDG funding helpers", () => {
  it("encodes an ERC-20 transfer call", () => {
    expect(encodeErc20Transfer(treasury, BigInt(1_250_000))).toBe(
      "0xa9059cbb000000000000000000000000222222222222222222222222222222222222222200000000000000000000000000000000000000000000000000000000001312d0",
    );
    expect(() => encodeErc20Transfer("nope", BigInt(1))).toThrow(/recipient/);
    expect(() => encodeErc20Transfer(treasury, -BigInt(1))).toThrow(/negative/);
  });

  it("parses positive decimal amounts into base units", () => {
    expect(parseAmount("1.25", 6)).toBe(BigInt(1_250_000));
    expect(parseAmount("7", 0)).toBe(BigInt(7));
    expect(() => parseAmount("", 6)).toThrow();
    expect(() => parseAmount("0", 6)).toThrow();
    expect(() => parseAmount("0.000", 6)).toThrow();
    expect(() => parseAmount("-1", 6)).toThrow();
    expect(() => parseAmount("NaN", 6)).toThrow();
    expect(() => parseAmount("1.0000001", 6)).toThrow(/decimal/);
    expect(() => parseAmount("1.", 6)).toThrow();
  });

  it("sums only successful matching treasury transfers", () => {
    const receipt = {
      status: "0x1",
      logs: [
        {
          address: token,
          topics: [TRANSFER_TOPIC, "0x".padEnd(66, "1"), recipientTopic],
          data: `0x${"0".repeat(63)}a`,
        },
        {
          address: token.toUpperCase(),
          topics: [TRANSFER_TOPIC, "0x".padEnd(66, "2"), recipientTopic],
          data: `0x${"0".repeat(63)}5`,
        },
        {
          address: "0x3333333333333333333333333333333333333333",
          topics: [TRANSFER_TOPIC, "0x".padEnd(66, "3"), recipientTopic],
          data: `0x${"0".repeat(63)}9`,
        },
      ],
    };
    expect(findTransferToTreasury(receipt, { token, treasury })).toBe(
      BigInt(15),
    );
    expect(
      findTransferToTreasury(
        { ...receipt, status: "0x0" },
        { token, treasury },
      ),
    ).toBeUndefined();
    expect(
      findTransferToTreasury(
        {
          ...receipt,
          logs: [
            {
              ...receipt.logs[0],
              topics: [
                TRANSFER_TOPIC,
                receipt.logs[0].topics[1],
                "0x".padEnd(66, "4"),
              ],
            },
          ],
        },
        { token, treasury },
      ),
    ).toBeUndefined();
    expect(
      findTransferToTreasury(receipt, {
        token: "0x4444444444444444444444444444444444444444",
        treasury,
      }),
    ).toBeUndefined();
    expect(
      findTransferToTreasury(
        {
          ...receipt,
          logs: [{ ...receipt.logs[0], data: "0x12" }],
        },
        { token, treasury },
      ),
    ).toBeUndefined();
  });

  it("converts USDG base units one-to-one with credits", () => {
    expect(creditsForUsdg(BigInt(1_500_000), 6)).toBe(1.5);
    expect(creditsForUsdg(BigInt(2), 0)).toBe(2);
    expect(() => creditsForUsdg(-BigInt(1), 6)).toThrow();
  });

  it("extracts a valid transfer sender", () => {
    expect(
      transferSender({
        from: "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD",
      }),
    ).toBe("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    expect(transferSender({})).toBeUndefined();
    expect(transferSender({ from: 42 })).toBeUndefined();
    expect(
      transferSender({ from: "0xabcdefabcdefabcdefabcdefabcdef" }),
    ).toBeUndefined();
    expect(transferSender(null)).toBeUndefined();
  });
});
