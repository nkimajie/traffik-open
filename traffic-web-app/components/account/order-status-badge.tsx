import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/types/api";
import { getOrderStatusLabel } from "@/lib/utils/order";

const statusVariantMap: Record<
  OrderStatus,
  "pending" | "processing" | "shipped" | "delivered" | "cancelled"
> = {
  PENDING_PAYMENT: "pending",
  PENDING: "pending",
  ACCEPTED: "processing",
  REJECTED: "cancelled",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

type OrderStatusBadgeProps = {
  status: OrderStatus;
};

export default function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return (
    <Badge variant={statusVariantMap[status]}>
      {getOrderStatusLabel(status)}
    </Badge>
  );
}
