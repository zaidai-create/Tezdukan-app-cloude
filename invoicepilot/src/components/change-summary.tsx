"use client";

import type { ChangePlanT } from "@/lib/schemas";

export function ChangeSummary({
  plan, onApprove, onModify, onCancel, busy,
}: {
  plan: ChangePlanT;
  onApprove: () => void;
  onModify: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="rounded-3xl bg-surface shadow-raised p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Proposed changes</h2>
            <p className="mt-1 text-sm text-ink-muted">Review carefully. Nothing will be modified until you approve.</p>
          </div>
        </div>

        {plan.summary && (
          <p className="mt-4 rounded-xl bg-surface-panel px-4 py-3 text-sm text-ink">{plan.summary}</p>
        )}

        <div className="mt-6 space-y-5">
          {plan.invoices.map((inv, i) => {
            const c = inv.changes;
            const rows: [string, string][] = [
              ["Original invoice number", c.keep_invoice_number === false ? "To be removed" : "Keep unchanged"],
              ["Customer reference", c.customer_reference ?? "—"],
              ["Internal supply serial", c.internal_supply_serial ?? "—"],
              ["Internal adjustment date", c.internal_adjustment_date ?? "—"],
              ["Company name", c.company_name ?? "—"],
              ["Company address", c.company_address ?? "—"],
              ["NTN", c.ntn ?? "—"],
              ["Registration details", c.registration_details ?? "—"],
            ];
            const annotations = (c.annotations ?? []).filter(Boolean);
            return (
              <div key={i} className="overflow-hidden rounded-2xl border border-line">
                <div className="flex items-center justify-between bg-surface-panel/60 px-4 py-2.5">
                  <div className="text-sm font-medium">{inv.label}</div>
                  {c.target.source_page ? (
                    <div className="text-xs text-ink-muted">PDF page {c.target.source_page}</div>
                  ) : null}
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-line">
                    {rows.map(([k, v]) => (
                      <tr key={k}>
                        <td className="w-1/3 px-4 py-2 text-ink-muted">{k}</td>
                        <td className="px-4 py-2">{v}</td>
                      </tr>
                    ))}
                    {annotations.length > 0 && (
                      <tr>
                        <td className="w-1/3 px-4 py-2 text-ink-muted align-top">Annotations</td>
                        <td className="px-4 py-2">
                          <ul className="list-disc pl-5 space-y-0.5">
                            {annotations.map((a, idx) => <li key={idx}>{a}</li>)}
                          </ul>
                        </td>
                      </tr>
                    )}
                    {c.notes && (
                      <tr>
                        <td className="w-1/3 px-4 py-2 text-ink-muted align-top">Notes</td>
                        <td className="px-4 py-2">{c.notes}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button disabled={busy} onClick={onApprove} className="rounded-xl bg-ink px-4 py-3 text-sm font-medium text-surface disabled:opacity-60">
            {busy ? "Working…" : "Approve and process"}
          </button>
          <button disabled={busy} onClick={onModify} className="rounded-xl border border-line px-4 py-3 text-sm font-medium hover:bg-surface-panel disabled:opacity-60">
            Request changes
          </button>
          <button disabled={busy} onClick={onCancel} className="rounded-xl px-4 py-3 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-60">
            Cancel project
          </button>
        </div>
      </div>
    </div>
  );
}
