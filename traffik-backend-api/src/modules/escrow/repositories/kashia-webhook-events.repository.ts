import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "src/modules/shared/base/repository.base";
import { DBCollectionNames } from "src/modules/shared/enums/db_collections_name.enum";
import { KashiaWebhookEventDocument } from "../schemas/kashia-webhook-event.schema";
import { KashiaWebhookEventStatus } from "../enums/kashia-webhook-event-status.enum";
import {
  KASHIA_WEBHOOK_ERROR_MAX_LENGTH,
  KASHIA_WEBHOOK_PROCESSING_STALE_MS,
  KASHIA_WEBHOOK_REPLAY_BACKOFF_MS,
  KASHIA_WEBHOOK_REPLAY_MAX_ATTEMPTS,
} from "../constants/kashia-webhook.constant";
import {
  KashiaWebhookClaim,
  KashiaWebhookRecordMeta,
} from "../interfaces/kashia-webhook-claim.interface";

/**
 * Webhook deliveries are written through `this.model` rather than the
 * BaseRepository helpers: those swallow errors, and de-duplication depends on
 * seeing the unique-index violation.
 */
@Injectable()
export class KashiaWebhookEventsRepository extends BaseRepository<KashiaWebhookEventDocument> {
  constructor(
    @InjectModel(DBCollectionNames.KASHIA_WEBHOOK_EVENTS)
    model: Model<KashiaWebhookEventDocument>,
  ) {
    super(model);
  }

  /**
   * Registers a delivery and decides whether this worker should handle it.
   *
   * - First delivery of a webhook_id: recorded as `processing`, claimed.
   * - Redelivery of a `failed` attempt, or of one stuck in `processing` longer
   *   than the stale threshold: re-claimed so it is retried.
   * - Any other redelivery: counted, not claimed. Its `status` tells the
   *   caller whether the event was handled (`processed`) or is still being
   *   handled (`processing`, which may yet fail).
   *
   * A replay of a stored delivery (`countDelivery: false`) claims the same
   * way but is not counted as a delivery from Kashia.
   */
  async claim(
    webhookId: string,
    event: string,
    payload: Record<string, unknown>,
    meta: KashiaWebhookRecordMeta = {},
    options: { countDelivery?: boolean } = {},
  ): Promise<KashiaWebhookClaim> {
    // A replay of a stored delivery is an attempt, not a Kashia delivery.
    const delivered = options.countDelivery === false ? 0 : 1;
    const now = new Date();

    try {
      await this.model.create({
        webhookId,
        event,
        payload,
        reference: meta.reference,
        orderId: meta.orderId,
        status: KashiaWebhookEventStatus.PROCESSING,
        attempts: 1,
        deliveries: 1,
        receivedAt: now,
        lastDeliveredAt: now,
        claimedAt: now,
      });
      return { claimed: true, attempt: 1 };
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) {
        throw error;
      }
    }

    const staleBefore = new Date(
      now.getTime() - KASHIA_WEBHOOK_PROCESSING_STALE_MS,
    );
    const retried = await this.model.findOneAndUpdate(
      {
        webhookId,
        $or: [
          { status: KashiaWebhookEventStatus.FAILED },
          {
            status: KashiaWebhookEventStatus.PROCESSING,
            claimedAt: { $lt: staleBefore },
          },
        ],
      },
      {
        $set: {
          status: KashiaWebhookEventStatus.PROCESSING,
          claimedAt: now,
          ...(delivered > 0 && { lastDeliveredAt: now }),
        },
        $inc: { attempts: 1, deliveries: delivered },
      },
      { new: true },
    );

    if (retried) {
      return { claimed: true, attempt: retried.attempts };
    }

    const duplicate = await this.model.findOneAndUpdate(
      { webhookId },
      delivered > 0
        ? { $set: { lastDeliveredAt: now }, $inc: { deliveries: 1 } }
        : {},
      { new: true },
    );

    return { claimed: false, status: duplicate?.status };
  }

  async markProcessed(webhookId: string, outcome?: string): Promise<void> {
    await this.model.updateOne(
      { webhookId },
      {
        $set: {
          status: KashiaWebhookEventStatus.PROCESSED,
          processedAt: new Date(),
          ...(outcome ? { outcome } : {}),
        },
        $unset: { lastError: "" },
      },
    );
  }

  /** Keeps the record (for audit and retry) and notes why handling failed. */
  async markFailed(webhookId: string, error: unknown): Promise<void> {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error";
    await this.model.updateOne(
      { webhookId },
      {
        $set: {
          status: KashiaWebhookEventStatus.FAILED,
          lastError: message.slice(0, KASHIA_WEBHOOK_ERROR_MAX_LENGTH),
        },
      },
    );
  }

  /**
   * Deliveries to handle again from their stored payload, oldest attempt
   * first: failed ones once their backoff (attempts so far times the base
   * backoff) has passed, and ones left `processing` past the stale threshold
   * (the worker died mid-way). Neither once they reach the attempt limit.
   */
  async findReplayable(
    now: Date,
    limit: number,
  ): Promise<KashiaWebhookEventDocument[]> {
    return this.model
      .find({
        attempts: { $lt: KASHIA_WEBHOOK_REPLAY_MAX_ATTEMPTS },
        $or: [
          {
            status: KashiaWebhookEventStatus.FAILED,
            $expr: {
              $lt: [
                "$claimedAt",
                {
                  $subtract: [
                    now,
                    {
                      $multiply: [
                        "$attempts",
                        KASHIA_WEBHOOK_REPLAY_BACKOFF_MS,
                      ],
                    },
                  ],
                },
              ],
            },
          },
          {
            status: KashiaWebhookEventStatus.PROCESSING,
            claimedAt: {
              $lt: new Date(now.getTime() - KASHIA_WEBHOOK_PROCESSING_STALE_MS),
            },
          },
        ],
      })
      .sort({ claimedAt: 1 })
      .limit(limit)
      .lean<KashiaWebhookEventDocument[]>();
  }
}
