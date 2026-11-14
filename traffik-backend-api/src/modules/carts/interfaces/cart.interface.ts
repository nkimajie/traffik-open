import {
  IProductDiscount,
  IProductVariation,
} from "../../products/interfaces/product.interface";

export interface ICartItem {
  productId: string;
  /** Mongo ID of the product variation (subdocument _id). Present when product has variations; undefined for products without variations. */
  variationId?: string;
  /** Variation details (type, colors, price, quantity). Populated in response when variationId is present. */
  variation?: IProductVariation;
  quantity: number;
  /** Unit list price before product/variation discount (snapshot). */
  listUnitPrice: number;
  /** Unit price charged after discount. */
  price: number;
  total: number;
  /** Snapshot of applied discount rule ({ amount, type }), if any. */
  discount?: IProductDiscount;
  /** Denormalised from the product so vendor queries avoid a products join. */
  vendorId?: string;
}

/** Store identity attached to a cart so clients need no separate vendor fetch. */
export interface ICartVendorSummary {
  _id: string;
  businessName?: string;
  storeLogo?: string | null;
  storeCoverPhoto?: string | null;
  isVerified?: boolean;
}

export interface ICart {
  userId: string;
  items: ICartItem[];
  subtotal: number;
  hasVoucher: boolean;
  voucherId?: string;
  voucher?: {
    name: string;
    code: string;
    percentage: number;
  };
  /** The single store this cart belongs to. Null while the cart is empty. */
  vendorId?: string | null;
  vendor?: ICartVendorSummary | null;
}

/**
 * A cart holds one store at a time. Returned with a 409 when an add would mix
 * stores, so the client can offer save-for-later or replace instead of just
 * surfacing an error string.
 */
export const CART_VENDOR_CONFLICT = "CART_VENDOR_CONFLICT";

export interface ICartVendorConflict {
  code: typeof CART_VENDOR_CONFLICT;
  /** Store already occupying the cart. */
  currentVendor: ICartVendorSummary;
  /** Store the shopper just tried to add from. */
  incomingVendor: ICartVendorSummary;
  /** Product that triggered the conflict, so the client can retry either action. */
  incomingProductId: string;
  incomingVariationId?: string;
  incomingQuantity: number;
}
