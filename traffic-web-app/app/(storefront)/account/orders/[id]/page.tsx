import OrderDetailContent from "./order-detail-content";

type OrderDetailPageProps = {
  params: { id: string };
};

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  return <OrderDetailContent params={params} />;
}
