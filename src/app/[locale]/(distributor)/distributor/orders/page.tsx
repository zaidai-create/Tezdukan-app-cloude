import { InboxPage } from "@/features/distributor/orders/inbox-page";

export default function Page(props: PageProps<"/[locale]/distributor/orders">) {
  return <InboxPage searchParams={props.searchParams} />;
}
