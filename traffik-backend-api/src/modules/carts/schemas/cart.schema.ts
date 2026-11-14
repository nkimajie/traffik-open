import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { ICart, ICartItem } from "../interfaces/cart.interface";
import { IProductDiscount } from "../../products/interfaces/product.interface";
import { ProductDiscountType } from "../../products/enums/product-discount-type.enum";

export type CartDocument = Document & Cart;

const CartLineDiscountSchema = new MongooseSchema<IProductDiscount>(
  {
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: Object.values(ProductDiscountType),
      required: true,
    },
  },
  { _id: false },
);

@Schema()
export class CartItem implements ICartItem {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Product", required: true })
  productId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false })
  variationId?: string;

  @Prop({ required: true, default: 1 })
  quantity: number;

  /** List / pre-discount unit price at time of add/sync. */
  @Prop({ required: true })
  listUnitPrice: number;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  total: number;

  @Prop({ type: CartLineDiscountSchema, required: false })
  discount?: IProductDiscount;

  /** Denormalised from the product so vendor queries avoid a products join. */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Vendor",
    required: false,
  })
  vendorId?: string;
}

const CartItemSchema = SchemaFactory.createForClass(CartItem);

@Schema({ timestamps: true })
export class Cart implements ICart {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  userId: string;

  @Prop({ type: [CartItemSchema], default: [] })
  items: CartItem[];

  @Prop({ default: 0 })
  subtotal: number;

  @Prop({ default: false })
  hasVoucher: boolean;

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

  /**
   * A cart belongs to exactly one store. Set from the first item added and
   * cleared when the cart empties, so mixing stores can be rejected up front.
   */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Vendor",
    required: false,
    default: null,
  })
  vendorId?: string | null;

  /**
   * Per-shopper checkout lock, so two concurrent checkouts cannot both reserve
   * stock and open duplicate orders. Expires on its own if a request dies.
   */
  @Prop({ type: String, required: false })
  checkoutLockToken?: string;

  @Prop({ type: Date, required: false })
  checkoutLockedUntil?: Date;
}

export const CartSchema = SchemaFactory.createForClass(Cart);
