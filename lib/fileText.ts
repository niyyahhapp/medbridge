// Turns an attached file into text INSIDE THE BROWSER. The file is never uploaded.
// Supports text files, PDFs (including scanned PDFs) and photos of a report.

export type Progress = (message: string) => void;

const MAX_MB = 15;
const MAX_PDF_PAGES = 5;

export async function fileToText(file: File, progress: Progress): Promise<string> {
  if (file.size > MAX_MB * 1024 * 1024) throw new Error(`This file is too big. Please use a file under ${MAX_MB} MB.`);
  const name = file.name.toLowerCase();

  if (file.type.startsWith("text/") || /\.(txt|md|csv)$/.test(name)) {
    progress("Reading the text file…");
    return clean(await file.text());
  }
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return pdfToText(file, progress);
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/.test(name)) {
    return clean(await ocr([file], progress));
  }
  throw new Error("This file type is not supported. Please use a PDF, a photo, or a text file.");
}

function clean(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function pdfToText(file: File, progress: Progress): Promise<string> {
  progress("Opening the PDF on your device…");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);

  // 1. Try the text layer (normal PDFs).
  const parts: string[] = [];
  for (let i = 1; i <= pages; i++) {
    progress(`Reading page ${i} of ${pages}…`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    const lines: string[] = [];
    for (const item of content.items as { str?: string; transform?: number[]; hasEOL?: boolean }[]) {
      if (typeof item.str !== "string") continue;
      const y = item.transform?.[5] ?? 0;
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line);
        line = "";
      }
      line += (line && !line.endsWith(" ") ? " " : "") + item.str;
      lastY = y;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
        lastY = null;
      }
    }
    if (line) lines.push(line);
    parts.push(lines.join("\n"));
  }
  const text = clean(parts.join("\n\n"));
  if (text.replace(/\s/g, "").length > 40) return text;

  // 2. Scanned PDF (pictures only): draw each page and read it like a photo.
  const images: Blob[] = [];
  for (let i = 1; i <= pages; i++) {
    progress(`This PDF is a scan. Preparing page ${i} of ${pages}…`);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
    images.push(await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png")));
  }
  return clean(await ocr(images, progress));
}

async function ocr(images: Blob[], progress: Progress): Promise<string> {
  progress("Getting the text reader ready (first time takes a few seconds)…");
  const { createWorker } = await import("tesseract.js");
  let current = 0;
  const worker = await createWorker(["eng", "fra"], 1, {
    workerPath: "/vendor/tesseract/worker.min.js",
    corePath: "/vendor/tesseract/core",
    langPath: "/vendor/tesseract/lang",
    gzip: true,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        const page = images.length > 1 ? ` (page ${current + 1} of ${images.length})` : "";
        progress(`Reading the text on your device${page}… ${Math.round(m.progress * 100)}%`);
      }
    },
  });
  try {
    const out: string[] = [];
    for (current = 0; current < images.length; current++) {
      const { data } = await worker.recognize(images[current]);
      out.push(data.text);
    }
    return out.join("\n\n");
  } finally {
    await worker.terminate();
  }
}
