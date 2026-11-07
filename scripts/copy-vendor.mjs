// Copies the PDF and photo-reading files into public/vendor so they are served
// from our own site (nothing is loaded from other websites).
import { cpSync, mkdirSync, readdirSync } from "node:fs";

const out = "public/vendor";
mkdirSync(`${out}/tesseract/core`, { recursive: true });
mkdirSync(`${out}/tesseract/lang`, { recursive: true });
cpSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", `${out}/pdf.worker.min.mjs`);
cpSync("node_modules/tesseract.js/dist/worker.min.js", `${out}/tesseract/worker.min.js`);
for (const f of readdirSync("node_modules/tesseract.js-core")) {
  if (/^tesseract-core.*\.(js|wasm)$/.test(f) && f.includes("lstm")) cpSync(`node_modules/tesseract.js-core/${f}`, `${out}/tesseract/core/${f}`);
}
cpSync("node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", `${out}/tesseract/lang/eng.traineddata.gz`);
cpSync("node_modules/@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz", `${out}/tesseract/lang/fra.traineddata.gz`);
console.log("vendor files copied");
