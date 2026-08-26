import { openDB } from "idb";

export type MediaHistoryItem = {
  id: string;
  kind: "image" | "video";
  prompt: string;
  redacted: string;
  receipt: import("./privacy").Receipt;
  url: string;
  stub: boolean;
  model: string;
  createdAt: number;
};

type MediaDB = {
  history: { key: string; value: MediaHistoryItem };
};

let dbPromise: ReturnType<typeof openDB<MediaDB>> | undefined;
const db = () =>
  (dbPromise ??= openDB<MediaDB>("umbra-media", 1, {
    upgrade(database) {
      database.createObjectStore("history");
    },
  }));

export const getMediaHistory = async (kind: MediaHistoryItem["kind"]) =>
  (await db())
    .getAll("history")
    .then((items) =>
      items
        .filter((item) => item.kind === kind)
        .sort((a, b) => b.createdAt - a.createdAt),
    );

export const saveMediaHistory = async (item: MediaHistoryItem) =>
  (await db()).put("history", item, item.id);
