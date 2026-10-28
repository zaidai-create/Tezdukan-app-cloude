import { OrdersPage } from "@/features/ordering/orders/orders-page";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OrdersPage searchParams={searchParams} />;
}
