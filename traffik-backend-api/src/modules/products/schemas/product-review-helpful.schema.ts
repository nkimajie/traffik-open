import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema, Types } from "mongoose";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";

export type ProductReviewHelpfulVoteDocument = ProductReviewHelpfulVote &
  Document;

@Schema({
  timestamps: true,
  collection: DBCollectionNames.PRODUCT_REVIEW_HELPFUL,
})
export class ProductReviewHelpfulVote {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: DBCollectionNames.PRODUCT_REVIEWS,
    required: true,
    index: true,
  })
  reviewId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: DBCollectionNames.USERS,
    required: true,
  })
  userId: Types.ObjectId;
}

export const ProductReviewHelpfulVoteSchema = SchemaFactory.createForClass(
  ProductReviewHelpfulVote,
);
ProductReviewHelpfulVoteSchema.index(
  { reviewId: 1, userId: 1 },
  { unique: true },
);
