export type StoredHolderProof = {
  address: string;
  tier: string;
  balance: string;
  proof: string;
  expiresAt: number;
};

const key = "umbra-holder-proof";

export const loadHolderProof = (): StoredHolderProof | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    const value = JSON.parse(
      localStorage.getItem(key) ?? "null",
    ) as Partial<StoredHolderProof> | null;
    if (
      !value ||
      typeof value.address !== "string" ||
      typeof value.tier !== "string" ||
      typeof value.balance !== "string" ||
      typeof value.proof !== "string" ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      localStorage.removeItem(key);
      return undefined;
    }
    return value as StoredHolderProof;
  } catch {
    localStorage.removeItem(key);
    return undefined;
  }
};

export const saveHolderProof = (value: StoredHolderProof) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
};

export const clearHolderProof = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
};
