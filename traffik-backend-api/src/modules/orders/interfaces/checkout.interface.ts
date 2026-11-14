import { ICart, ICartItem } from "../../carts/interfaces/cart.interface";
import { AddressDocument } from "../../addresses/schemas/address.schema";
import { DeliveryMethod } from "../enums/order.enum";

/** Priced checkout for the shopper's cart; the basis of a new order. */
export interface CheckoutCalculation {
  userId: string;
  vendorId: string;
  items: ICartItem[];
  shippingAddress: AddressDocument;
  deliveryMethod: DeliveryMethod;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  voucherId?: ICart["voucherId"];
  voucher?: ICart["voucher"];
}

/** Either a checkout to place, or the reason it cannot be placed. */
export interface CheckoutCalculationResult {
  error?: string;
  data?: CheckoutCalculation;
}
