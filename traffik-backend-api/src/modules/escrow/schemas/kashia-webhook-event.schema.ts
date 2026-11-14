import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";
import { KashiaWebhookEventStatus } from "../enums/kashia-webhook-event-status.enum";

export type KashiaWebhookEventDocument = Document & KashiaWebhookEvent;

/**
 * One record per Kashia `webhook_id`. Doubles as the de-duplication lock and
 * the audit trail of every delivery, including retries and failures.
 */
@Schema({
  timestamps: true,
  collection: DBCollectionNames.KASHIA_WEBHOOK_EVENTS,
})
export class KashiaWebhookEvent {
  @Prop({ required: true, unique: true, index: true })
  webhookId: string;

  @Prop({ required: true })
  event: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload: Record<string, unknown>;

  /** Kashia payment link / escrow reference, copied out for searching. */
  @Prop({ index: true })
  reference?: string;

  /** Traffik order id from the payment metadata, copied out for searching. */
  @Prop({ index: true })
  orderId?: string;

  @Prop({
    type: String,
    enum: Object.values(KashiaWebhookEventStatus),
    default: KashiaWebhookEventStatus.PROCESSING,
    index: true,
  })
  status: KashiaWebhookEventStatus;

  /** Times handling was started (first attempt plus retries). */
  @Prop({ default: 1 })
  attempts: number;

  /** Times Kashia delivered this webhook_id, including ignored duplicates. */
  @Prop({ default: 1 })
  deliveries: number;

  @Prop({ default: Date.now })
  receivedAt: Date;

  @Prop({ default: Date.now })
  lastDeliveredAt: Date;

  /** When the current/most recent processing attempt was claimed. */
  @Prop({ default: Date.now })
  claimedAt: Date;

  @Prop()
  processedAt?: Date;

  /** Short handler result, e.g. "order confirmed", "order not found". */
  @Prop()
  outcome?: string;

  /** Message of the error that failed the most recent attempt. */
  @Prop()
  lastError?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const KashiaWebhookEventSchema =
  SchemaFactory.createForClass(KashiaWebhookEvent);

// Replaying failed or abandoned deliveries, oldest attempt first.
KashiaWebhookEventSchema.index({ status: 1, claimedAt: 1 });
