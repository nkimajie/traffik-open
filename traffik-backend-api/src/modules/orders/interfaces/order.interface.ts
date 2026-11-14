import { DeliveryMethod, OrderStatus } from "../enums/order.enum";
import { ICartItem } from "../../carts/interfaces/cart.interface";
import { IAddress } from "../../addresses/interfaces/address.interface";
import { IOrderRefund } from "./order-refund.interface";
import { IOrderPaymentAlert } from "./order-escrow.interface";

export interface IOrderTimeline {
  status: OrderStatus;
  description: string;
  date: Date;
}

export interface IOrder {
  userId: string;
  /** The single store this order belongs to. */
  vendorId?: string;
  /** Human-readable reference, e.g. TRF-4K7Q2M. */
  orderRef?: string;
  items: ICartItem[];
  shippingAddress: IAddress;
  deliveryMethod: DeliveryMethod;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  voucherId?: string;
  voucher?: {
    name: string;
    code: string;
    percentage: number;
  };
  timeline: IOrderTimeline[];
  stockReserved?: boolean;
  stockCommitted?: boolean;
  /** When a sweep last checked this unpaid order's stock hold. */
  stockHoldCheckedAt?: Date;
  paymentReference?: string;
  paymentUrl?: string;
  escrowId?: string;
  escrowStatus?: string;
  /** Refunds owed to the shopper for payments captured on this order. */
  refunds?: IOrderRefund[];
  /** Escrows Kashia has reported refunded. */
  providerRefundedEscrowIds?: string[];
  escrowStatusAt?: Date;
  /** Where the order and its money disagree; kept until an admin resolves it. */
  paymentAlerts?: IOrderPaymentAlert[];
}
