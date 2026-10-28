import { OrderDetailPage } from "@/features/ordering/orders/order-detail-page";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <OrderDetailPage params={params} />;
}
