import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { DBCollectionNames } from "src/modules/shared/enums/db_collections_name.enum";
import { RefundPayoutReferenceDocument } from "../schemas/refund-payout-reference.schema";

/**
 * Written through the model directly: BaseRepository swallows errors, and the
 * claim depends on seeing the unique-index violation.
 */
@Injectable()
export class RefundPayoutReferencesRepository {
  constructor(
    @InjectModel(DBCollectionNames.REFUND_PAYOUT_REFERENCES)
    private readonly model: Model<RefundPayoutReferenceDocument>,
  ) {}

  /**
   * Reserves `referenceKey` for one refund's completion. Returns false if it
   * is held by a different refund. The same refund can claim it again (a
   * retry, or re-recording after a reopen); the claim then moves to the new
   * completion.
   */
  async claim(
    referenceKey: string,
    orderId: Types.ObjectId,
    refundId: Types.ObjectId,
    completionId: Types.ObjectId,
  ): Promise<boolean> {
    try {
      await this.model.create({
        referenceKey,
        orderId,
        refundId,
        completionId,
      });
      return true;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) {
        throw error;
      }
    }

    const ownClaim = await this.model.findOneAndUpdate(
      { referenceKey, orderId, refundId },
      { $set: { completionId } },
    );
    return !!ownClaim;
  }

  /**
   * Frees a reference, only while `completionId` still holds it: never one
   * held by another refund, nor one the same refund has since claimed again.
   */
  async release(
    referenceKey: string,
    orderId: Types.ObjectId,
    refundId: Types.ObjectId,
    completionId: Types.ObjectId,
  ): Promise<void> {
    await this.model.deleteOne({
      referenceKey,
      orderId,
      refundId,
      completionId,
    });
  }
}
