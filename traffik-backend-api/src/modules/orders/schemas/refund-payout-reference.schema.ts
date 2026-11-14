import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";

export type RefundPayoutReferenceDocument = Document & RefundPayoutReference;

/**
 * Claims a manual payout reference for exactly one refund. The unique index
 * is what stops one bank transfer being recorded against two refunds, even
 * when two admins submit at the same moment.
 */
@Schema({
  timestamps: true,
  collection: DBCollectionNames.REFUND_PAYOUT_REFERENCES,
})
export class RefundPayoutReference {
  /** Normalised payout reference. */
  @Prop({ required: true, unique: true })
  referenceKey: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  orderId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  refundId: string;

  /**
   * The completion currently using the reference. Releasing names it, so a
   * release left over from an earlier completion (e.g. a reopen) cannot free
   * the reference once the refund has been recorded with it again.
   */
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  completionId: string;

  createdAt: Date;
  updatedAt: Date;
}

export const RefundPayoutReferenceSchema = SchemaFactory.createForClass(
  RefundPayoutReference,
);
