export enum DeliveryMethod {
  PICKUP_STATION = "PICKUP_STATION",
  DOOR_DELIVERY = "DOOR_DELIVERY",
}

export enum OrderStatus {
  /** Order placed, awaiting payment capture. Stock is reserved, not committed. */
  PENDING_PAYMENT = "PENDING_PAYMENT",
  /** Paid and waiting for the store to respond. */
  PENDING = "PENDING",
  /** Store accepted and is preparing the order. */
  ACCEPTED = "ACCEPTED",
  /** Store declined. Terminal; payment is refunded. */
  REJECTED = "REJECTED",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  /**
   * @deprecated Superseded by ACCEPTED. Retained so historical orders written
   * before the vendor states existed still deserialise.
   */
  PROCESSING = "PROCESSING",
}

/** Statuses an order can no longer move out of. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.REJECTED,
  OrderStatus.CANCELLED,
];

/**
 * Permitted status transitions. Enforced centrally because the previous
 * implementation accepted any status from any status, which allowed a delivered
 * order to be moved back to pending.
 */
export const ORDER_STATUS_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PENDING, OrderStatus.CANCELLED],
  [OrderStatus.PENDING]: [
    OrderStatus.ACCEPTED,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.ACCEPTED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.REJECTED]: [],
  [OrderStatus.CANCELLED]: [],
};

/** Transitions a store may perform on its own order. */
export const VENDOR_ORDER_TRANSITIONS: readonly OrderStatus[] = [
  OrderStatus.ACCEPTED,
  OrderStatus.REJECTED,
  OrderStatus.SHIPPED,
];

/**
 * Statuses a shopper may cancel from: before the store has accepted. After
 * that the store is already working on it and cancellation is a support matter.
 */
export const SHOPPER_CANCELLABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.PENDING,
];

/** Moving to one of these returns the order's stock to inventory. */
export const STOCK_RELEASING_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.REJECTED,
  OrderStatus.CANCELLED,
];

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return (ORDER_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

/** Paid orders the store has not shipped yet: fulfilment can still be stopped. */
export const PAID_UNSHIPPED_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PROCESSING,
];

/** Orders whose goods have left the store. */
export const SHIPPED_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/** Orders that ended without being fulfilled. */
export const UNFULFILLED_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
];
