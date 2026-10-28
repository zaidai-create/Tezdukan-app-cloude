import { OrderPlacedPage } from "@/features/ordering/orders/order-placed-page";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OrderPlacedPage searchParams={searchParams} />;
}
