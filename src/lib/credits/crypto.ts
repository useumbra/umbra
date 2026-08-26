export type CreditLedgerEntry = {
  id: string;
  kind: "grant" | "debit";
  amount: number;
  description: string;
  createdAt: number;
};

export type CreditVaultData = {
  ledger: CreditLedgerEntry[];
};

export type EncryptedVault = {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const deriveKey = async (passphrase: string, salt: Uint8Array) => {
  if (!passphrase) throw new Error("A passphrase is required");
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 310_000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

export const balanceOf = (ledger: CreditLedgerEntry[]) =>
  ledger.reduce(
    (balance, entry) =>
      balance + (entry.kind === "grant" ? entry.amount : -entry.amount),
    0,
  );

export const addGrant = (
  vault: CreditVaultData,
  amount: number,
  description = "Test credits",
): CreditVaultData => {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("Grant amount must be positive");
  return {
    ledger: [
      ...vault.ledger,
      {
        id: crypto.randomUUID(),
        kind: "grant",
        amount,
        description,
        createdAt: Date.now(),
      },
    ],
  };
};

export const deductCredits = (
  vault: CreditVaultData,
  amount: number,
  description: string,
): CreditVaultData => {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("Debit amount must be positive");
  if (balanceOf(vault.ledger) < amount) throw new Error("Insufficient credits");
  return {
    ledger: [
      ...vault.ledger,
      {
        id: crypto.randomUUID(),
        kind: "debit",
        amount,
        description,
        createdAt: Date.now(),
      },
    ],
  };
};

export const encryptVault = async (
  vault: CreditVaultData,
  passphrase: string,
): Promise<EncryptedVault> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    encoder.encode(JSON.stringify(vault)),
  );
  return {
    version: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
};

export const decryptVault = async (
  encrypted: EncryptedVault,
  passphrase: string,
): Promise<CreditVaultData> => {
  if (encrypted.version !== 1) throw new Error("Unsupported vault version");
  const salt = base64ToBytes(encrypted.salt);
  const iv = base64ToBytes(encrypted.iv);
  const key = await deriveKey(passphrase, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    base64ToBytes(encrypted.ciphertext),
  );
  const vault = JSON.parse(decoder.decode(plaintext)) as CreditVaultData;
  if (!Array.isArray(vault.ledger)) throw new Error("Invalid vault data");
  return vault;
};

export const exportVault = (encrypted: EncryptedVault) =>
  JSON.stringify({ format: "umbra-vault", ...encrypted }, null, 2);

export const importVault = (contents: string): EncryptedVault => {
  const parsed = JSON.parse(contents) as EncryptedVault & { format?: string };
  if (
    parsed.format !== "umbra-vault" ||
    parsed.version !== 1 ||
    !parsed.salt ||
    !parsed.iv ||
    !parsed.ciphertext
  )
    throw new Error("Invalid Umbra vault file");
  return {
    version: 1,
    salt: parsed.salt,
    iv: parsed.iv,
    ciphertext: parsed.ciphertext,
  };
};
