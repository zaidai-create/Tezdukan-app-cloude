// Deterministic PDF engine. Pure functions over pdf-lib — safe to run from
// API routes or from a Node script. It performs no network or secret access.
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { InvoiceChangeT } from "@/lib/schemas";

// Deterministic PDF operations. The AI only plans changes; this module
// actually mutates documents. The original upload is never modified: we
// always produce a working copy.

export async function extractPdfPages(bytes: Uint8Array): Promise<{ pageCount: number; sizes: { width: number; height: number }[] }> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const sizes = pdf.getPages().map((p) => {
    const { width, height } = p.getSize();
    return { width, height };
  });
  return { pageCount: pdf.getPageCount(), sizes };
}

// Lightweight text probe. pdf-lib does not expose a text extractor, so we
// perform a defensive scan of the content stream bytes for operator
// sequences that imply presence of extractable text. Returns a boolean plus
// the raw byte length — useful as a signal for the UI.
export async function pdfTextProbe(bytes: Uint8Array): Promise<{ hasText: boolean; size: number }> {
  const needle = /\(([^)]{3,})\)\s*Tj/;
  const text = Buffer.from(bytes).toString("latin1");
  return { hasText: needle.test(text), size: bytes.byteLength };
}

export type ApplyPlanInput = {
  pdfBytes: Uint8Array;
  imageAttachments: { bytes: Uint8Array; mime: string }[];
  changesByPage: Map<number, InvoiceChangeT>;
};

export async function applyApprovedAnnotations(input: ApplyPlanInput): Promise<Uint8Array> {
  const { pdfBytes, imageAttachments, changesByPage } = input;

  // Working copy — leave the original bytes untouched.
  const working = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await working.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await working.embedFont(StandardFonts.Helvetica);

  const pages = working.getPages();
  for (let i = 0; i < pages.length; i++) {
    const change = changesByPage.get(i + 1);
    if (!change) continue;
    const page = pages[i];
    const { width, height } = page.getSize();

    // Draw a corner stamp: Internal adjustment panel.
    const stampX = width - 240;
    const stampY = 24;
    page.drawRectangle({
      x: stampX,
      y: stampY,
      width: 220,
      height: 96,
      color: rgb(0.98, 0.98, 0.99),
      borderColor: rgb(0.85, 0.85, 0.88),
      borderWidth: 0.75,
      opacity: 0.95,
    });

    page.drawText("INTERNAL ADJUSTMENT", {
      x: stampX + 10, y: stampY + 76, size: 8, font, color: rgb(0.1, 0.1, 0.12),
    });

    const lines: string[] = [];
    if (change.internal_supply_serial) lines.push(`Supply S/N: ${change.internal_supply_serial}`);
    if (change.internal_adjustment_date) lines.push(`Adj. date: ${change.internal_adjustment_date}`);
    if (change.customer_reference) lines.push(`Cust. ref: ${change.customer_reference}`);
    if (change.company_name) lines.push(`Company: ${change.company_name}`);
    if (change.ntn) lines.push(`NTN: ${change.ntn}`);
    for (const note of change.annotations ?? []) lines.push(note);
    if (change.notes) lines.push(change.notes);

    let y = stampY + 60;
    for (const line of lines.slice(0, 6)) {
      page.drawText(truncate(line, 42), {
        x: stampX + 10, y, size: 8, font: bodyFont, color: rgb(0.1, 0.1, 0.12),
      });
      y -= 10;
    }

    // Keep invoice number visible — never overwrite unless explicitly asked.
    if (change.keep_invoice_number === false && change.customer_reference) {
      // Intentionally do not modify the printed invoice number. We only
      // surface the user-requested reference in the stamp.
    }
  }

  // Append each new image as its own page. This preserves the original
  // PDF content and places supplied images in the final output.
  for (const attach of imageAttachments) {
    const image = attach.mime.includes("png")
      ? await working.embedPng(attach.bytes)
      : await working.embedJpg(attach.bytes);
    const ratio = image.width / image.height;
    const pageSize: [number, number] = ratio >= 1 ? [842, 595] : [595, 842];
    const page = working.addPage(pageSize);
    const margin = 24;
    const maxW = pageSize[0] - margin * 2;
    const maxH = pageSize[1] - margin * 2 - 24;
    const drawW = Math.min(maxW, maxH * ratio);
    const drawH = drawW / ratio;
    page.drawImage(image, {
      x: (pageSize[0] - drawW) / 2,
      y: (pageSize[1] - drawH) / 2,
      width: drawW,
      height: drawH,
    });
    page.drawText("Attached invoice image", {
      x: margin, y: margin / 2, size: 8, font, color: rgb(0.4, 0.4, 0.45),
    });
  }

  return working.save();
}

export async function validateFinalPdf(bytes: Uint8Array, expectedMinPages: number): Promise<{ ok: boolean; issues: string[]; pageCount: number }> {
  const issues: string[] = [];
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const n = pdf.getPageCount();
    if (n < expectedMinPages) issues.push(`Expected at least ${expectedMinPages} pages, found ${n}.`);
    for (let i = 0; i < pdf.getPages().length; i++) {
      const { width, height } = pdf.getPage(i).getSize();
      if (width < 100 || height < 100) issues.push(`Page ${i + 1} has tiny dimensions.`);
    }
    return { ok: issues.length === 0, issues, pageCount: n };
  } catch (err) {
    issues.push("Output PDF failed to open: " + (err as Error).message);
    return { ok: false, issues, pageCount: 0 };
  }
}

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

// Silence unused-import warning when degrees is not applied in future tweaks.
void degrees;
