import { db } from "./db";

export type ApiKeyRecord = {
  jti: string;
  key: string;
  label: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
};

export const getApiKeys = async () =>
  (await db())
    .getAll("apiKeys")
    .then((records) =>
      records.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    );

export const saveApiKey = async (record: ApiKeyRecord) =>
  (await db()).put("apiKeys", record, record.jti);

export const markApiKeyRevoked = async (jti: string) => {
  const database = await db();
  const record = await database.get("apiKeys", jti);
  if (record) await database.put("apiKeys", { ...record, revoked: true }, jti);
};

export const deleteApiKey = async (jti: string) =>
  (await db()).delete("apiKeys", jti);

export const clearApiKeys = async () => (await db()).clear("apiKeys");
