import { Types } from "mongoose";
import {
  OrderRefundActor,
  OrderRefundEventType,
  OrderRefundPayoutMethod,
  OrderRefundReason,
  OrderRefundResolution,
  OrderRefundStatus,
} from "../enums/order-refund.enum";

/** Evidence an admin gives for a refund they made by hand. */
export interface IOrderRefundPayout {
  method: OrderRefundPayoutMethod;
  /** As entered, e.g. the bank transfer or Kashia refund reference. */
  reference: string;
  /** Normalised `reference`, used to stop one payout closing two refunds. */
  referenceKey: string;
  /** Naira sent; always equal to the refund amount. */
  amount: number;
}

/** One entry in a refund's append-only history. */
export interface IOrderRefundEvent {
  _id?: Types.ObjectId;
  type: OrderRefundEventType;
  actor: OrderRefundActor;
  /** Admin or shopper id, when a person acted. */
  actorId?: string;
  at: Date;
  /** Why it was opened or reopened. */
  reason?: string;
  /** Evidence given with a manual completion. */
  payout?: Omit<IOrderRefundPayout, "referenceKey">;
  /** Set when Kashia refunded money an admin says was already paid back another way. */
  possibleDoubleRefund?: boolean;
}

/**
 * A refund the platform owes the shopper for one captured payment. An order
 * can carry several (e.g. a cancelled paid order that was then paid again),
 * so each is tied to the escrow that holds the money.
 */
export interface IOrderRefund {
  _id?: Types.ObjectId;
  status: OrderRefundStatus;
  reason: OrderRefundReason;
  /** Amount to return, in naira (the order's unit). */
  amount: number;
  /** Kashia escrow holding the money, when known. */
  escrowId?: string;
  /** Kashia payment link the money was paid through, when known. */
  paymentReference?: string;
  requestedAt: Date;
  refundedAt?: Date;
  resolvedBy?: OrderRefundResolution;
  /** Admin who completed the refund by hand, for audit. */
  resolvedByAdminId?: string;
  /** Evidence for a refund completed by hand. */
  payout?: IOrderRefundPayout;
  /** Identifies the current manual completion, so only it can be rolled back. */
  completionId?: Types.ObjectId;
  /** When Kashia confirmed the money was returned; such a refund cannot be reopened. */
  providerConfirmedAt?: Date;
  /** Shown to the shopper. */
  note?: string;
  history: IOrderRefundEvent[];
}

/** What is needed to open a refund obligation. */
export type NewOrderRefund = Pick<
  IOrderRefund,
  "reason" | "amount" | "escrowId" | "paymentReference"
>;

/** Identifies which escrow Kashia reported as refunded. */
export interface EscrowRefundedEvent {
  escrowId?: string;
  paymentReference?: string;
}

/**
 * What an `escrow.refunded` report did:
 * - `completed`: closed a refund that was still owed
 * - `confirmed`: confirmed a refund an admin completed through Kashia
 * - `possible_double_refund`: an admin had already paid it back another way
 * - `unmatched`: no refund on the order for that escrow (remembered, so one
 *   opened later is closed at once)
 */
export type EscrowRefundedOutcome =
  | "completed"
  | "confirmed"
  | "possible_double_refund"
  | "unmatched";

/** Evidence required from an admin completing a refund by hand. */
export interface ManualRefundEvidence {
  method: OrderRefundPayoutMethod;
  reference: string;
  /** Naira; must equal the refund amount, as a check the right refund is being closed. */
  amount: number;
  note?: string;
}
