import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import {
  IProduct,
  IProductVariation,
  IDefaultVariation,
  IProductDiscount,
} from "../interfaces/product.interface";
import { ProductStatus } from "../enums/product-status.enum";
import { ProductDiscountType } from "../enums/product-discount-type.enum";
import { ProductGender } from "../enums/product-gender.enum";

export type ProductDocument = Product & Document;

const ProductDiscountSchema = new MongooseSchema<IProductDiscount>(
  {
    amount: { type: Number, required: true, min: 0 },
    type: {
      type: String,
      enum: Object.values(ProductDiscountType),
      required: true,
    },
  },
  { _id: false },
);

const ProductVariationSchema = new MongooseSchema<IProductVariation>(
  {
    name: { type: String, required: true },
    attributes: { type: MongooseSchema.Types.Mixed, required: true },
    price: Number,
    quantity: { type: Number, required: true },
  },
  { _id: true },
);

const DefaultVariationSchema = new MongooseSchema<IDefaultVariation>(
  {
    name: { type: String, required: true },
    attributes: { type: MongooseSchema.Types.Mixed, required: true },
    price: Number,
    quantity: { type: Number, required: true },
  },
  { _id: false },
);

@Schema({ timestamps: true })
export class Product implements IProduct {
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ type: ProductDiscountSchema, required: false, default: null })
  discount?: IProductDiscount;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Category",
    required: true,
  })
  categoryId: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Subcategory",
    required: false,
    default: null,
  })
  subcategoryId?: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Vendor", required: true })
  vendorId: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  /** Mixed allows legacy array values in DB until documents are re-saved. */
  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: null,
  })
  gender: ProductGender | null;

  @Prop({ type: [ProductVariationSchema], default: [] })
  variations: IProductVariation[];

  @Prop({ type: DefaultVariationSchema, required: false })
  defaultVariation?: IDefaultVariation;

  @Prop({ default: false })
  hasVariations: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 0 })
  rating: number;

  @Prop({ default: 0 })
  totalRatings: number;

  @Prop({ default: ProductStatus.ACTIVE })
  status: ProductStatus;

  createdAt: Date;
  updatedAt: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

function normalizeGender(raw: unknown): ProductGender | null {
  const allowed = Object.values(ProductGender);
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s === "") {
      return null;
    }
    return allowed.includes(s as ProductGender) ? (s as ProductGender) : null;
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return null;
    }
    const first = raw[0];
    if (typeof first === "string" && allowed.includes(first as ProductGender)) {
      return first as ProductGender;
    }
    return null;
  }
  return null;
}

ProductSchema.set("toJSON", {
  transform(_doc, ret: Record<string, unknown>) {
    if (!("subcategoryId" in ret) || ret.subcategoryId === undefined) {
      ret.subcategoryId = null;
    }
    ret.gender = normalizeGender(ret.gender);
    return ret;
  },
});

// Pre-save: hasVariations is true when product has explicit variations
ProductSchema.pre("save", function (next) {
  this.hasVariations = !!(this.variations && this.variations.length > 0);
  (this as { gender?: unknown }).gender = normalizeGender(
    (this as { gender?: unknown }).gender,
  );
  next();
});
