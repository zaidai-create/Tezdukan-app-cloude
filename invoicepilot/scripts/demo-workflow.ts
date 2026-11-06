// Demo workflow — exercises the deterministic PDF engine end-to-end without
// touching Supabase or OpenAI. Produces a sample output PDF under /tmp.
//
// Usage: npx tsx scripts/demo-workflow.ts
//
// This script is the quickest way to prove the processing engine works on
// your machine before wiring up Supabase + OpenAI.

import { PDFDocument, StandardFonts } from "pdf-lib";
import { writeFile } from "node:fs/promises";
import { applyApprovedAnnotations, validateFinalPdf, extractPdfPages } from "../src/lib/pdf/engine";

async function buildSamplePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const body = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([595, 842]);
  p1.drawText("ACME SUPPLIERS LTD", { x: 40, y: 790, size: 18, font });
  p1.drawText("Invoice #INV-2026-001", { x: 40, y: 760, size: 12, font: body });
  p1.drawText("Customer: Beta Trading", { x: 40, y: 740, size: 11, font: body });
  p1.drawText("Date: 2026-11-01", { x: 40, y: 720, size: 11, font: body });
  p1.drawText("Total: PKR 125,500", { x: 40, y: 700, size: 11, font: body });
  const p2 = doc.addPage([595, 842]);
  p2.drawText("ACME SUPPLIERS LTD", { x: 40, y: 790, size: 18, font });
  p2.drawText("Invoice #INV-2026-002", { x: 40, y: 760, size: 12, font: body });
  p2.drawText("Customer: Gamma Enterprises", { x: 40, y: 740, size: 11, font: body });
  return new Uint8Array(await doc.save());
}

async function main() {
  console.log("1) Building a sample 2-page invoice PDF…");
  const pdfBytes = await buildSamplePdf();
  const { pageCount } = await extractPdfPages(pdfBytes);
  console.log(`   Pages: ${pageCount}`);

  console.log("2) Applying approved internal-adjustment annotations…");
  const out = await applyApprovedAnnotations({
    pdfBytes,
    imageAttachments: [],
    changesByPage: new Map([
      [1, {
        target: { source_page: 1 },
        keep_invoice_number: true,
        internal_supply_serial: "SUP/2026/11/001",
        internal_adjustment_date: "2026-11-06",
        customer_reference: "REF-BETA-042",
        company_name: "Beta Trading (PVT) LTD",
        ntn: "1234567-8",
        annotations: ["Internal file copy — not for supplier"],
      }],
      [2, {
        target: { source_page: 2 },
        keep_invoice_number: true,
        internal_supply_serial: "SUP/2026/11/002",
        internal_adjustment_date: "2026-11-06",
      }],
    ]),
  });

  console.log("3) Validating final PDF…");
  const qc = await validateFinalPdf(out, pageCount);
  console.log(`   ok=${qc.ok}, pages=${qc.pageCount}, issues=${qc.issues.join(" | ") || "none"}`);

  const dest = "/tmp/invoicepilot-demo-output.pdf";
  await writeFile(dest, out);
  console.log(`Done. Wrote ${dest} (${out.byteLength} bytes).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
