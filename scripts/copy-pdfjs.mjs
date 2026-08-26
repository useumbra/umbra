import { access, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = [
  ["node_modules/pdfjs-dist/build/pdf.min.mjs", "public/pdf.min.mjs"],
  [
    "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
    "public/pdf.worker.min.mjs",
  ],
];

for (const [sourceRelative, destinationRelative] of assets) {
  const source = resolve(root, sourceRelative);
  const destination = resolve(root, destinationRelative);
  try {
    await access(source);
  } catch {
    throw new Error(`Missing PDF.js asset: ${source}`);
  }
  await copyFile(source, destination);
  console.log(`Copied ${sourceRelative} to ${destinationRelative}`);
}
