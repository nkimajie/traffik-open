import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema, Types } from "mongoose";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";

export type ProductReviewDocument = ProductReview & Document;

@Schema({ timestamps: true, collection: DBCollectionNames.PRODUCT_REVIEWS })
export class ProductReview {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: DBCollectionNames.PRODUCTS,
    required: true,
    index: true,
  })
  productId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: DBCollectionNames.USERS,
    required: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: String, default: "" })
  comment: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  orderId: Types.ObjectId | null;

  @Prop({ type: Boolean, default: false })
  isVerifiedPurchase: boolean;

  @Prop({ type: Number, default: 0 })
  helpfulCount: number;

  @Prop({ type: String, required: true })
  reviewerDisplayName: string;

  @Prop({ type: String, default: null })
  reviewerAvatarUrl: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const ProductReviewSchema = SchemaFactory.createForClass(ProductReview);
ProductReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
