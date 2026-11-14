import { Types } from "mongoose";
import { OrderStatus } from "../enums/order.enum";
import {
  EscrowLifecycleEvent,
  OrderPaymentAlertType,
} from "../enums/order-escrow.enum";

/** Kashia escrow details mirrored onto an order. */
export interface OrderEscrowFields {
  escrowId?: string;
  escrowStatus?: string;
  paymentReference?: string;
}

/** Escrow details reported with a captured payment (`escrow.active`). */
export interface OrderPaymentConfirmation extends OrderEscrowFields {
  /** Amount Kashia reports as paid, in kobo; logged if it differs from the order. */
  amountKobo?: number;
}

export interface UpdateOrderEscrowOptions {
  /** Apply only while the order is in this status (e.g. don't regress a paid order). */
  onlyIfOrderStatus?: OrderStatus;
  /** Apply only while the order has no escrow, so its own escrow is never replaced. */
  onlyIfNoEscrowId?: boolean;
}

export interface CancelPendingPaymentOptions {
  /**
   * Cancel only while this is still the order's active payment link, so the
   * expiry of a replaced link cannot cancel an order with a newer, live link.
   */
  paymentReference?: string;
  /** Mirrored escrow status to record, e.g. "expired" when Kashia expired the link. */
  escrowStatus?: string;
}

/** A Kashia escrow lifecycle event, as it concerns one order. */
export interface OrderEscrowEvent {
  event: EscrowLifecycleEvent;
  escrowId?: string;
  paymentReference?: string;
  /** Status Kashia reports; defaults to the event name. */
  escrowStatus?: string;
  /** When Kashia says it happened; used to ignore events that arrive late. */
  occurredAt?: Date;
}

/** A disagreement between an order and its money, kept until an admin resolves it. */
export interface IOrderPaymentAlert {
  _id?: Types.ObjectId;
  type: OrderPaymentAlertType;
  /** Escrow the alert is about. */
  escrowId?: string;
  /** Order status when it was raised. */
  orderStatus: OrderStatus;
  message: string;
  raisedAt: Date;
  resolvedAt?: Date;
  resolvedByAdminId?: string;
  resolutionNote?: string;
}
