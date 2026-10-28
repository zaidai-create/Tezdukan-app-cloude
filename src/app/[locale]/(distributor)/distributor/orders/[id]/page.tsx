import { OrgOrderPage } from "@/features/distributor/orders/order-page";

export default function Page(props: PageProps<"/[locale]/distributor/orders/[id]">) {
  return <OrgOrderPage params={props.params} />;
}
