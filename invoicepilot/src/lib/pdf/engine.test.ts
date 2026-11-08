import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractPdfPages, applyApprovedAnnotations, validateFinalPdf } from "./engine";

async function makeSamplePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([595, 842]);
  p1.drawText("Invoice #INV-001 — Acme Co", { x: 40, y: 780, size: 14, font });
  p1.drawText("Total: PKR 25,000", { x: 40, y: 760, size: 12, font });
  const p2 = doc.addPage([595, 842]);
  p2.drawText("Invoice #INV-002 — Beta Ltd", { x: 40, y: 780, size: 14, font });
  return new Uint8Array(await doc.save());
}

describe("PDF engine", () => {
  it("extracts page count and sizes", async () => {
    const bytes = await makeSamplePdf();
    const info = await extractPdfPages(bytes);
    expect(info.pageCount).toBe(2);
    expect(info.sizes[0].width).toBeCloseTo(595, 0);
  });

  it("applies annotations without losing pages", async () => {
    const bytes = await makeSamplePdf();
    const out = await applyApprovedAnnotations({
      pdfBytes: bytes,
      imageAttachments: [],
      changesByPage: new Map([
        [1, {
          target: { source_page: 1 },
          keep_invoice_number: true,
          internal_supply_serial: "SUPPLY/2026/001",
          internal_adjustment_date: "2026-11-06",
          customer_reference: "ABC-42",
          annotations: ["Internal copy only"],
        }],
      ]),
    });
    const qc = await validateFinalPdf(out, 2);
    expect(qc.ok).toBe(true);
    expect(qc.pageCount).toBe(2);
    // Reload the output and confirm page sizes match the input (nothing was
    // cropped or reshaped).
    const info = await extractPdfPages(out);
    expect(info.sizes[0].width).toBeCloseTo(595, 0);
    expect(info.sizes[0].height).toBeCloseTo(842, 0);
  });

  it("appends an image as a new page", async () => {
    const bytes = await makeSamplePdf();
    // Minimal 1x1 PNG.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX/AAAZ4gk3AAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
      "base64",
    );
    const out = await applyApprovedAnnotations({
      pdfBytes: bytes,
      imageAttachments: [{ bytes: new Uint8Array(png), mime: "image/png" }],
      changesByPage: new Map(),
    });
    const qc = await validateFinalPdf(out, 3);
    expect(qc.ok).toBe(true);
    expect(qc.pageCount).toBe(3);
  });
});
