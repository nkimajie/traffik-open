import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import { Config } from "src/config/configuration";
import { OrdersService } from "src/modules/orders/services/orders.service";
import {
  KashiaWebhookData,
  KashiaWebhookPayload,
} from "../interfaces/kashia-webhook.interface";
import { KashiaWebhookEventsRepository } from "../repositories/kashia-webhook-events.repository";
import { KashiaWebhookRecordMeta } from "../interfaces/kashia-webhook-claim.interface";
import {
  KashiaWebhookProcessResult,
  KashiaWebhookReplayResult,
} from "../interfaces/kashia-webhook-result.interface";
import { KashiaWebhookEventDocument } from "../schemas/kashia-webhook-event.schema";
import { KashiaWebhookEventStatus } from "../enums/kashia-webhook-event-status.enum";
import {
  KASHIA_WEBHOOK_REPLAY_BATCH,
  KASHIA_WEBHOOK_REPLAY_BUDGET_MS,
  KASHIA_WEBHOOK_REPLAY_MAX_ATTEMPTS,
} from "../constants/kashia-webhook.constant";
import { OrderStatus } from "src/modules/orders/enums/order.enum";
import { EscrowLifecycleEvent } from "src/modules/orders/enums/order-escrow.enum";
import {
  resolveOrderIdFromMetadata,
  verifyKashiaWebhookSignature,
} from "../utils/kashia-webhook.util";

@Injectable()
export class KashiaWebhookService {
  private readonly logger = new Logger(KashiaWebhookService.name);

  constructor(
    private readonly webhookEventsRepository: KashiaWebhookEventsRepository,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
  ) {}

  verifySignature(
    payload: KashiaWebhookPayload,
    signature: string | undefined,
    rawBody?: Buffer | string,
  ): boolean {
    return verifyKashiaWebhookSignature(
      payload,
      signature,
      Config.getValue("KASHIA_WEBHOOK_SECRET"),
      rawBody,
    );
  }

  /**
   * Handles one delivery exactly once per `webhook_id`. Throws when handling
   * fails so the caller can answer non-2xx and Kashia redelivers; the record is
   * kept as `failed` and the redelivery is retried.
   */
  async processEvent(
    payload: KashiaWebhookPayload,
    options: { replay?: boolean } = {},
  ): Promise<KashiaWebhookProcessResult> {
    const data = payload.data ?? {};
    const meta: KashiaWebhookRecordMeta = {
      reference: data.reference,
      orderId: resolveOrderIdFromMetadata(data.metadata),
    };

    if (!payload.webhook_id) {
      // Nothing to de-duplicate on; handlers are idempotent, so process it
      // rather than drop a (signed) payment event.
      this.logger.warn(
        `Kashia webhook without webhook_id (event=${payload.event}, reference=${meta.reference ?? "n/a"}); processing without de-duplication`,
      );
      const outcome = await this.dispatchEvent(payload);
      return { disposition: "processed", outcome };
    }

    const claim = await this.webhookEventsRepository.claim(
      payload.webhook_id,
      payload.event,
      payload as unknown as Record<string, unknown>,
      meta,
      { countDelivery: !options.replay },
    );

    if (!claim.claimed) {
      if (claim.status === KashiaWebhookEventStatus.PROCESSING) {
        // The earlier attempt may still fail: acknowledging this delivery
        // would tell Kashia the event was handled when it might not be.
        this.logger.log(
          `Kashia webhook still being processed by an earlier delivery (event=${payload.event}, webhook_id=${payload.webhook_id}); not acknowledging this one`,
        );
        return { disposition: "in_progress" };
      }
      this.logger.log(
        `Duplicate Kashia webhook ignored (event=${payload.event}, webhook_id=${payload.webhook_id}, status=${claim.status ?? "unknown"})`,
      );
      return { disposition: "duplicate" };
    }

    if (claim.attempt > 1) {
      this.logger.warn(
        `Retrying Kashia webhook (event=${payload.event}, webhook_id=${payload.webhook_id}, attempt=${claim.attempt})`,
      );
    }

    let outcome: string;
    try {
      outcome = await this.dispatchEvent(payload);
    } catch (error) {
      await this.webhookEventsRepository
        .markFailed(payload.webhook_id, error)
        .catch((markError) => {
          this.logger.error(
            `Failed to mark Kashia webhook ${payload.webhook_id} as failed`,
            markError,
          );
        });
      throw error;
    }

    await this.webhookEventsRepository.markProcessed(
      payload.webhook_id,
      outcome,
    );
    return { disposition: "processed", outcome, attempt: claim.attempt };
  }

  /**
   * Handles again, from the payload stored when they arrived (after their
   * signature was verified), deliveries that failed or were left half-done,
   * so an event is not lost when Kashia stops redelivering it. Goes through
   * {@link processEvent}, whose claim lets only one of a replay and a Kashia
   * redelivery handle an event. Stops when nothing is left to replay or the
   * time budget has passed.
   */
  async replayPendingDeliveries(
    options: { timeBudgetMs?: number } = {},
  ): Promise<KashiaWebhookReplayResult> {
    const startedAt = Date.now();
    const budget = options.timeBudgetMs ?? KASHIA_WEBHOOK_REPLAY_BUDGET_MS;
    const outOfTime = () => Date.now() - startedAt >= budget;
    const seen = new Set<string>();
    const result: KashiaWebhookReplayResult = {
      attempted: 0,
      recovered: 0,
      failed: 0,
      gaveUp: 0,
    };

    while (!outOfTime()) {
      const records = (
        await this.webhookEventsRepository.findReplayable(
          new Date(),
          KASHIA_WEBHOOK_REPLAY_BATCH,
        )
      ).filter((record) => !seen.has(record.webhookId));
      if (records.length === 0) {
        break;
      }

      for (const record of records) {
        if (outOfTime()) {
          break;
        }
        seen.add(record.webhookId);
        await this.replayDelivery(record, result);
      }
    }

    if (result.attempted > 0) {
      this.logger.log(
        `Kashia webhook replay: attempted ${result.attempted}, recovered ${result.recovered}, failed ${result.failed}, gave up ${result.gaveUp}`,
      );
    }
    return result;
  }

  private async replayDelivery(
    record: KashiaWebhookEventDocument,
    result: KashiaWebhookReplayResult,
  ): Promise<void> {
    const payload = record.payload as unknown as KashiaWebhookPayload;
    try {
      const processed = await this.processEvent(payload, { replay: true });
      if (processed.disposition === "processed") {
        result.attempted++;
        result.recovered++;
        this.logger.log(
          `Replayed Kashia webhook ${record.webhookId} (event=${record.event}, attempt=${processed.attempt ?? "?"}, outcome=${processed.outcome ?? "n/a"})`,
        );
      }
      // Otherwise a Kashia redelivery has it, or it was handled meanwhile.
    } catch (error) {
      result.attempted++;
      result.failed++;
      const message = error instanceof Error ? error.message : String(error);
      if (record.attempts + 1 >= KASHIA_WEBHOOK_REPLAY_MAX_ATTEMPTS) {
        result.gaveUp++;
        this.logger.error(
          `Kashia webhook ${record.webhookId} (event=${record.event}, reference=${record.reference ?? "n/a"}, order=${record.orderId ?? "n/a"}) failed ${record.attempts + 1} times; no more automatic retries. Last error: ${message}`,
        );
      } else {
        this.logger.warn(
          `Replay of Kashia webhook ${record.webhookId} (event=${record.event}) failed again: ${message}`,
        );
      }
    }
  }

  /** Routes to the handler; returns a short outcome for logs and the record. */
  private async dispatchEvent(payload: KashiaWebhookPayload): Promise<string> {
    switch (payload.event) {
      case "escrow.active":
        return this.handleEscrowActive(payload.data);
      case "payment_link.expired":
        return this.handlePaymentLinkExpired(payload.data);
      case "escrow.created":
        return this.handleEscrowCreated(payload.data);
      case "escrow.refunded":
        return this.handleEscrowRefunded(payload);
      case "escrow.awaiting_confirmation":
      case "escrow.completed":
      case "escrow.cancelled":
      case "escrow.disputed":
        return this.handleEscrowLifecycle(payload);
      default:
        this.logger.log(`Unhandled Kashia webhook event: ${payload.event}`);
        return "event not handled";
    }
  }

  private async handleEscrowActive(data: KashiaWebhookData): Promise<string> {
    const orderId = await this.resolveOrderId(data);
    if (!orderId) {
      this.logger.warn(
        `escrow.active webhook missing order metadata (reference=${data.reference ?? "n/a"})`,
      );
      return "order not resolved";
    }

    const result = await this.ordersService.confirmOrderPayment(orderId, {
      escrowId: data.id,
      escrowStatus: data.status ?? "active",
      paymentReference: data.reference,
      amountKobo: typeof data.amount === "number" ? data.amount : undefined,
    });

    if (result.failed && result.code !== 200) {
      this.logger.error(
        `Failed to confirm payment for order ${orderId}: ${result.description}`,
      );
      return `not confirmed: ${result.description}`;
    }

    return result.description === "Payment already confirmed"
      ? "order already confirmed"
      : "order confirmed";
  }

  private async handlePaymentLinkExpired(
    data: KashiaWebhookData,
  ): Promise<string> {
    const orderId =
      (await this.resolveOrderId(data)) ??
      (data.reference
        ? await this.ordersService.findOrderIdByPaymentReference(data.reference)
        : undefined);

    if (!orderId) {
      this.logger.warn(
        `payment_link.expired webhook could not resolve order (reference=${data.reference ?? "n/a"})`,
      );
      return "order not resolved";
    }

    const result = await this.ordersService.cancelPendingPaymentOrder(
      orderId,
      "Payment link expired",
      { paymentReference: data.reference, escrowStatus: "expired" },
    );
    return result.failed
      ? `not cancelled: ${result.description}`
      : result.description;
  }

  private async handleEscrowCreated(data: KashiaWebhookData): Promise<string> {
    const orderId = await this.resolveOrderId(data);
    if (!orderId) {
      return "order not resolved";
    }

    // Only while still unpaid: if escrow.active was handled first, do not
    // regress the mirrored status back to "pending".
    await this.ordersService.updateOrderEscrowFields(
      orderId,
      {
        escrowId: data.id,
        escrowStatus: data.status ?? "pending",
        paymentReference: data.reference,
      },
      { onlyIfOrderStatus: OrderStatus.PENDING_PAYMENT },
    );
    return "escrow fields recorded";
  }

  /**
   * Lets the order follow its escrow (see OrdersService.handleEscrowEvent):
   * a returned payment stops fulfilment, a completed one delivers a shipped
   * order, and disagreements raise an alert for an admin.
   */
  private async handleEscrowLifecycle(
    payload: KashiaWebhookPayload,
    orderId?: string,
  ): Promise<string> {
    const data = payload.data ?? {};
    const resolvedOrderId = orderId ?? (await this.resolveOrderId(data));
    if (!resolvedOrderId) {
      this.logger.warn(
        `${payload.event} webhook could not resolve order (escrow=${data.id ?? "n/a"}, reference=${data.reference ?? "n/a"})`,
      );
      return "order not resolved";
    }

    return this.ordersService.handleEscrowEvent(resolvedOrderId, {
      event: payload.event.replace(/^escrow\./, "") as EscrowLifecycleEvent,
      escrowId: data.id,
      paymentReference: data.reference,
      escrowStatus: data.status,
      occurredAt: this.eventTime(payload),
    });
  }

  /**
   * Kashia returned the money in an escrow: close the refund owed for it and
   * let the order follow (a paid order not yet shipped is cancelled). Either
   * step can come first: the escrow is remembered as refunded, so a refund
   * the cancellation opens is closed at once rather than left for an admin
   * to pay again.
   */
  private async handleEscrowRefunded(
    payload: KashiaWebhookPayload,
  ): Promise<string> {
    const data = payload.data ?? {};
    const orderId = await this.resolveOrderId(data);
    if (!orderId) {
      this.logger.warn(
        `escrow.refunded webhook could not resolve order (escrow=${data.id ?? "n/a"}, reference=${data.reference ?? "n/a"})`,
      );
      return "order not resolved";
    }

    const refund = await this.ordersService.recordEscrowRefunded(orderId, {
      escrowId: data.id,
      paymentReference: data.reference,
    });
    const order = await this.handleEscrowLifecycle(payload, orderId);

    switch (refund) {
      case "completed":
        return `${order}; refund completed`;
      case "confirmed":
        return `${order}; manual refund confirmed by Kashia`;
      case "possible_double_refund":
        // Logged as an error, with the details, by OrdersService.
        return `${order}; possible double refund flagged`;
      default:
        this.logger.warn(
          `escrow.refunded for order ${orderId} matched no refund (escrow=${data.id ?? "n/a"}, reference=${data.reference ?? "n/a"}); remembered in case one is opened later`,
        );
        return `${order}; no refund matched (remembered)`;
    }
  }

  /** When Kashia says the event happened, if it sent a usable time. */
  private eventTime(payload: KashiaWebhookPayload): Date | undefined {
    if (!payload.timestamp) return undefined;
    const time = new Date(payload.timestamp);
    return Number.isNaN(time.getTime()) ? undefined : time;
  }

  private async resolveOrderId(data: KashiaWebhookData): Promise<string | undefined> {
    const fromMetadata = resolveOrderIdFromMetadata(data.metadata);
    if (fromMetadata) {
      return fromMetadata;
    }

    if (data.reference) {
      return this.ordersService.findOrderIdByPaymentReference(data.reference);
    }

    return undefined;
  }
}
