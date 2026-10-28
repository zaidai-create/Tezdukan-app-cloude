import { LedgerStatement } from "@/features/ordering/ledger/ledger-statement";

export default function Page({ params }: { params: Promise<{ orgId: string }> }) {
  return <LedgerStatement params={params} />;
}
