import type { Receipt } from "./privacy";

export const MAX_ATTACHMENT_TEXT = 120_000;
export type AttachmentKind = "text" | "pdf" | "image";

export type AttachmentMetadata = {
  name: string;
  size: number;
  kind: AttachmentKind;
  extractedCharacters: number;
  truncated?: boolean;
};

export type AttachmentDraft = {
  id: string;
  file: File;
  metadata: AttachmentMetadata;
  text: string;
  dataUrl?: string;
};

type PdfTextItem = { str: string };
type PdfTextContentItem = PdfTextItem | { type: string; id: string };
type PdfTextContent = { items: PdfTextContentItem[] };
type PdfPage = {
  getTextContent: () => Promise<PdfTextContent>;
};
type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
};
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: {
    data: Uint8Array;
    useWorkerFetch: boolean;
    isEvalSupported: boolean;
  }) => { promise: Promise<PdfDocument> };
};

const textExtensions = new Set(["txt", "md", "csv", "json"]);

const extension = (name: string) => name.toLowerCase().split(".").pop() ?? "";

const kindFor = (file: File): AttachmentKind | undefined => {
  if (file.type === "application/pdf" || extension(file.name) === "pdf")
    return "pdf";
  if (file.type.startsWith("image/")) return "image";
  if (textExtensions.has(extension(file.name))) return "text";
  return undefined;
};

const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });

const readPdf = async (file: File) => {
  const pdfModuleUrl: string = "/pdf.min.mjs";
  // Keep the URL typed as string and use webpackIgnore to avoid rebundling PDF.js.
  const pdfjs = (await import(
    /* webpackIgnore: true */ pdfModuleUrl
  )) as unknown as PdfJs;
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const document = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" "),
    );
  }
  return pages.join("\n\n");
};

export const readAttachment = async (
  file: File,
  id: string,
): Promise<AttachmentDraft> => {
  const kind = kindFor(file);
  if (!kind)
    throw new Error("Attach a .txt, .md, .csv, .json, PDF, or image file.");
  if (kind === "image") {
    return {
      id,
      file,
      metadata: {
        name: file.name,
        size: file.size,
        kind,
        extractedCharacters: 0,
      },
      text: "",
      dataUrl: await readDataUrl(file),
    };
  }
  const text = kind === "pdf" ? await readPdf(file) : await file.text();
  return {
    id,
    file,
    metadata: {
      name: file.name,
      size: file.size,
      kind,
      extractedCharacters: text.length,
    },
    text,
  };
};

export const combineReceipts = (
  receipts: Receipt[],
  originalLength: number,
  redactedLength: number,
): Receipt => {
  const entities = receipts.flatMap((receipt) => receipt.entities);
  return {
    count: entities.length,
    entities,
    originalLength,
    redactedLength,
  };
};
