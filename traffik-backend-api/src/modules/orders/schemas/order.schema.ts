import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { DeliveryMethod, OrderStatus } from "../enums/order.enum";
import { IOrder } from "../interfaces/order.interface";
import { IOrderPaymentAlert } from "../interfaces/order-escrow.interface";
import { OrderPaymentAlertType } from "../enums/order-escrow.enum";
import {
  IOrderRefund,
  IOrderRefundEvent,
  IOrderRefundPayout,
} from "../interfaces/order-refund.interface";
import {
  OrderRefundActor,
  OrderRefundEventType,
  OrderRefundPayoutMethod,
  OrderRefundReason,
  OrderRefundResolution,
  OrderRefundStatus,
} from "../enums/order-refund.enum";

export type OrderDocument = Document & Order;

const OrderPaymentAlertSchema = new MongooseSchema<IOrderPaymentAlert>(
  {
    type: {
      type: String,
      enum: Object.values(OrderPaymentAlertType),
      required: true,
    },
    escrowId: { type: String, required: false },
    orderStatus: { type: String, enum: OrderStatus, required: true },
    message: { type: String, required: true },
    raisedAt: { type: Date, required: true, default: Date.now },
    resolvedAt: { type: Date, required: false },
    resolvedByAdminId: { type: String, required: false },
    resolutionNote: { type: String, required: false },
  },
  { _id: true },
);

const payoutFields = {
  method: {
    type: String,
    enum: Object.values(OrderRefundPayoutMethod),
    required: true,
  },
  reference: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
};

const OrderRefundPayoutSchema = new MongooseSchema<IOrderRefundPayout>(
  { ...payoutFields, referenceKey: { type: String, required: true } },
  { _id: false },
);

const OrderRefundEventSchema = new MongooseSchema<IOrderRefundEvent>(
  {
    type: {
      type: String,
      enum: Object.values(OrderRefundEventType),
      required: true,
    },
    actor: {
      type: String,
      enum: Object.values(OrderRefundActor),
      required: true,
    },
    actorId: { type: String, required: false },
    at: { type: Date, required: true, default: Date.now },
    reason: { type: String, required: false },
    payout: {
      type: new MongooseSchema(payoutFields, { _id: false }),
      required: false,
    },
    possibleDoubleRefund: { type: Boolean, required: false },
  },
  { _id: true },
);

const OrderRefundSchema = new MongooseSchema<IOrderRefund>(
  {
    status: {
      type: String,
      enum: Object.values(OrderRefundStatus),
      required: true,
      default: OrderRefundStatus.REQUIRED,
    },
    reason: {
      type: String,
      enum: Object.values(OrderRefundReason),
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    escrowId: { type: String, required: false },
    paymentReference: { type: String, required: false },
    requestedAt: { type: Date, required: true, default: Date.now },
    refundedAt: { type: Date, required: false },
    resolvedBy: {
      type: String,
      enum: Object.values(OrderRefundResolution),
      required: false,
    },
    resolvedByAdminId: { type: String, required: false },
    payout: { type: OrderRefundPayoutSchema, required: false },
    completionId: { type: MongooseSchema.Types.ObjectId, required: false },
    providerConfirmedAt: { type: Date, required: false },
    note: { type: String, required: false },
    history: { type: [OrderRefundEventSchema], default: [] },
  },
  { _id: true },
);

@Schema({ timestamps: true })
export class Order implements IOrder {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  userId: string;

  /**
   * The single store this order belongs to. Carts are store-scoped, so an order
   * never spans vendors and the store's order inbox needs no products join.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Vendor",
    required: false,
    index: true,
  })
  vendorId?: string;

  /**
   * Human-readable reference for support and for payment-gateway metadata.
   * Stored rather than derived from `_id`, which was neither unique nor queryable.
   */
  @Prop({ type: String, required: false, unique: true, sparse: true })
  orderRef?: string;

  // We embed copies of CartItem and Address so historical orders don't change if the original product/address is deleted or updated
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
  items: any[];

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  shippingAddress: any;

  @Prop({ type: String, enum: DeliveryMethod, required: true })
  deliveryMethod: DeliveryMethod;

  @Prop({ required: true })
  subtotal: number;

  @Prop({ default: 0 })
  discount: number;

  @Prop({ default: 0 })
  shippingFee: number;

  @Prop({ required: true })
  total: number;

  @Prop({
    type: String,
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Voucher",
    required: false,
  })
  voucherId?: string;

  @Prop({
    type: {
      name: String,
      code: String,
      percentage: Number,
    },
    required: false,
  })
  voucher?: {
    name: string;
    code: string;
    percentage: number;
  };

  @Prop({
    type: [
      {
        status: { type: String, enum: OrderStatus },
        description: { type: String },
        date: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  timeline: {
    status: OrderStatus;
    description: string;
    date: Date;
  }[];

  /**
   * Whether this order currently holds a stock reservation. Set while awaiting
   * payment and cleared once stock is either committed or released, so a retry
   * or a duplicate webhook cannot double-count inventory.
   */
  @Prop({ default: false })
  stockReserved: boolean;

  /** Whether the reserved stock has been deducted from inventory. */
  @Prop({ default: false })
  stockCommitted: boolean;

  /**
   * When a sweep last checked this unpaid order's hold with Kashia and left
   * it in place (its payment link was still open). Sweeps take unchecked and
   * least recently checked holds first, so every stale hold gets its turn.
   */
  @Prop({ type: Date, required: false })
  stockHoldCheckedAt?: Date;

  /** Kashia payment link reference, e.g. PL-a1b2c3d4. */
  @Prop({ type: String, required: false, index: true, sparse: true })
  paymentReference?: string;

  /** Hosted Kashia checkout URL returned when the payment link is created. */
  @Prop({ type: String, required: false })
  paymentUrl?: string;

  /** Kashia escrow UUID once payment is captured. */
  @Prop({ type: String, required: false, index: true, sparse: true })
  escrowId?: string;

  /** Mirror of Kashia escrow status (pending, active, completed, etc.). */
  @Prop({ type: String, required: false })
  escrowStatus?: string;

  /**
   * When Kashia says `escrowStatus` happened. An event older than this for
   * the same escrow arrived late and is not applied.
   */
  @Prop({ type: Date, required: false })
  escrowStatusAt?: Date;

  /**
   * Where the order and its money disagree (a dispute, money released for a
   * cancelled order, a payment returned after shipping) and a person has to
   * act. Kept until an admin resolves it.
   */
  @Prop({ type: [OrderPaymentAlertSchema], default: [] })
  paymentAlerts: IOrderPaymentAlert[];

  /**
   * Refunds owed to the shopper, one per captured payment that has to go
   * back (paid order cancelled or declined, payment on a cancelled order, a
   * duplicate payment). Kept on the order so nothing depends on a log line.
   */
  @Prop({ type: [OrderRefundSchema], default: [] })
  refunds: IOrderRefund[];

  /**
   * Escrows Kashia has reported refunded. Kept so a refund opened after that
   * report (events can arrive out of order) is closed at once instead of
   * being paid again by hand.
   */
  @Prop({ type: [String], default: [] })
  providerRefundedEscrowIds: string[];

  createdAt: Date;
  updatedAt: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Finding a shopper's open checkouts for a store, and unpaid orders holding
// stock past their hold window. Non-unique, so safe to build on existing data.
OrderSchema.index({ userId: 1, vendorId: 1, status: 1 });
OrderSchema.index({ status: 1, createdAt: 1 });
// Sweeps of abandoned checkouts: unchecked and least recently checked first.
OrderSchema.index({ status: 1, stockHoldCheckedAt: 1, createdAt: 1 });
// The admin queue of refunds still to be made.
OrderSchema.index({ "refunds.status": 1, createdAt: -1 });
// The admin queue of payment problems still to be resolved.
OrderSchema.index({ "paymentAlerts.resolvedAt": 1, createdAt: -1 });
