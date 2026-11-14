import type {
  DeliveryMethod,
  Order,
  OrderItem,
  OrderPaymentAlertType,
  OrderRefund,
  OrderRefundPayoutMethod,
  OrderRefundReason,
  OrderStatus,
} from "@/lib/types/api";

const OPEN_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PENDING",
  "ACCEPTED",
  "PROCESSING",
  "SHIPPED",
];
const CLOSED_STATUSES: OrderStatus[] = ["DELIVERED", "CANCELLED", "REJECTED"];

export function formatOrderDate(date?: string): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getOrderStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    PENDING_PAYMENT: "Awaiting payment",
    PENDING: "Pending",
    ACCEPTED: "Accepted by store",
    REJECTED: "Declined by store",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };
  return labels[status];
}

export function getRefundReasonLabel(reason: OrderRefundReason): string {
  const labels: Record<OrderRefundReason, string> = {
    ORDER_CANCELLED: "Order cancelled",
    ORDER_REJECTED: "Declined by store",
    PAID_AFTER_CANCELLATION: "Paid after the order was cancelled",
    DUPLICATE_PAYMENT: "Duplicate payment",
  };
  return labels[reason] ?? "Refund";
}

export function getRefundPayoutMethodLabel(
  method: OrderRefundPayoutMethod,
): string {
  const labels: Record<OrderRefundPayoutMethod, string> = {
    KASHIA: "Refunded through Kashia",
    BANK_TRANSFER: "Bank transfer",
    OTHER: "Other",
  };
  return labels[method] ?? method;
}

/** Keep in step with REFUND_NOT_RECEIVED_WINDOW_DAYS on the server. */
export const REFUND_NOT_RECEIVED_WINDOW_DAYS = 30;

/**
 * Whether the shopper can report this refund as not received: it was marked
 * sent by hand, Kashia has not confirmed it, and it is recent enough.
 */
export function canReportRefundNotReceived(
  refund: OrderRefund,
  now: number = Date.now(),
): boolean {
  if (refund.status !== "REFUNDED" || refund.resolvedBy !== "ADMIN") {
    return false;
  }
  if (refund.providerConfirmedAt || !refund.refundedAt) return false;
  const windowMs = REFUND_NOT_RECEIVED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return now - new Date(refund.refundedAt).getTime() <= windowMs;
}

/** The most recent history entry, e.g. to show why a refund is back in the queue. */
export function getLatestRefundEvent(refund: OrderRefund) {
  return refund.history?.length
    ? refund.history[refund.history.length - 1]
    : undefined;
}

export function getPaymentAlertLabel(type: OrderPaymentAlertType): string {
  const labels: Record<OrderPaymentAlertType, string> = {
    ESCROW_DISPUTED: "Payment disputed",
    ESCROW_REVERSED_AFTER_SHIPPING: "Payment returned after shipping",
    ESCROW_CANCELLED_AFTER_PAYMENT: "Kashia cancelled a paid escrow",
    ESCROW_RELEASED_FOR_CANCELLED_ORDER: "Store paid for a cancelled order",
    ESCROW_RELEASED_BEFORE_SHIPPING: "Store paid before shipping",
    OTHER_ESCROW_RELEASED: "Store paid a duplicate payment",
  };
  return labels[type] ?? type;
}

/** Refunds still to be returned to the shopper. */
export function getOutstandingRefunds(order: Pick<Order, "refunds">): OrderRefund[] {
  return (order.refunds ?? []).filter((refund) => refund.status === "REQUIRED");
}

export function getDeliveryMethodLabel(method: DeliveryMethod): string {
  return method === "DOOR_DELIVERY" ? "Door delivery" : "Pickup station";
}

export function formatOrderNumber(order: Pick<Order, "_id" | "orderRef">): string {
  if (order.orderRef) return order.orderRef;
  const hex = order._id.replace(/[^a-fA-F0-9]/g, "");
  const tail = hex.slice(-7) || "0";
  const n = parseInt(tail, 16);
  const num = Number.isNaN(n) ? 0 : n % 10_000_000;
  return String(num).padStart(7, "0");
}

export function isOpenOrderStatus(status: OrderStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export function isClosedOrderStatus(status: OrderStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

export function partitionOrders(orders: Order[]) {
  return {
    open: orders.filter((order) => isOpenOrderStatus(order.status)),
    closed: orders.filter((order) => isClosedOrderStatus(order.status)),
  };
}

export function getOrderItemName(item: OrderItem): string {
  return item.name || "Product";
}

export function getOrderItemImage(item: OrderItem, productId: string): string {
  return (
    item.images?.[0] ??
    `https://picsum.photos/seed/${productId}/600/600`
  );
}

export function getOrderItemVendorId(item: OrderItem): string {
  return item.vendorId ?? "";
}

export function getOrderItemVendorName(item: OrderItem): string {
  return item.vendorName ?? "Store";
}
