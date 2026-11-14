import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as crypto from "crypto";
import * as request from "supertest";
import { App } from "supertest/types";
import { KashiaWebhookController } from "src/modules/escrow/controllers/kashia-webhook.controller";
import { KashiaWebhookService } from "src/modules/escrow/services/kashia-webhook.service";
import { KashiaWebhookEventsRepository } from "src/modules/escrow/repositories/kashia-webhook-events.repository";
import { KashiaWebhookEventStatus } from "src/modules/escrow/enums/kashia-webhook-event-status.enum";
import { KashiaWebhookClaim } from "src/modules/escrow/interfaces/kashia-webhook-claim.interface";
import { OrdersService } from "src/modules/orders/services/orders.service";
import {
  KASHIA_WEBHOOK_IN_PROGRESS_RETRY_AFTER_S,
  KASHIA_WEBHOOK_PROCESSING_STALE_MS,
  KASHIA_WEBHOOK_REPLAY_BACKOFF_MS,
  KASHIA_WEBHOOK_REPLAY_MAX_ATTEMPTS,
} from "src/modules/escrow/constants/kashia-webhook.constant";

const SECRET = "e2e-webhook-secret";

/**
 * In-memory stand-in for the webhook events collection with the same claim
 * rules as the repository (unique webhook_id; failed attempts are retried).
 * Lets the HTTP pipeline be exercised end to end without MongoDB.
 */
class FakeWebhookEventsRepository {
  readonly records = new Map<
    string,
    {
      event: string;
      payload: Record<string, unknown>;
      status: KashiaWebhookEventStatus;
      attempts: number;
      deliveries: number;
      claimedAt: Date;
      outcome?: string;
      lastError?: string;
    }
  >();

  async claim(
    webhookId: string,
    event: string,
    payload: Record<string, unknown>,
    _meta: unknown = {},
    options: { countDelivery?: boolean } = {},
  ): Promise<KashiaWebhookClaim> {
    const delivered = options.countDelivery === false ? 0 : 1;
    const existing = this.records.get(webhookId);
    if (!existing) {
      this.records.set(webhookId, {
        event,
        payload,
        status: KashiaWebhookEventStatus.PROCESSING,
        attempts: 1,
        deliveries: 1,
        claimedAt: new Date(),
      });
      return { claimed: true, attempt: 1 };
    }
    existing.deliveries += delivered;
    const stale =
      existing.status === KashiaWebhookEventStatus.PROCESSING &&
      existing.claimedAt.getTime() <
        Date.now() - KASHIA_WEBHOOK_PROCESSING_STALE_MS;
    if (existing.status === KashiaWebhookEventStatus.FAILED || stale) {
      existing.status = KashiaWebhookEventStatus.PROCESSING;
      existing.attempts += 1;
      existing.claimedAt = new Date();
      return { claimed: true, attempt: existing.attempts };
    }
    return { claimed: false, status: existing.status };
  }

  async markProcessed(webhookId: string, outcome?: string): Promise<void> {
    const record = this.records.get(webhookId)!;
    record.status = KashiaWebhookEventStatus.PROCESSED;
    record.outcome = outcome;
    delete record.lastError;
  }

  async markFailed(webhookId: string, error: unknown): Promise<void> {
    const record = this.records.get(webhookId)!;
    record.status = KashiaWebhookEventStatus.FAILED;
    record.lastError = error instanceof Error ? error.message : String(error);
  }

  /** Same rules as the repository: failed past backoff, or abandoned. */
  async findReplayable(now: Date, limit: number) {
    return [...this.records.entries()]
      .filter(
        ([, r]) =>
          r.attempts < KASHIA_WEBHOOK_REPLAY_MAX_ATTEMPTS &&
          ((r.status === KashiaWebhookEventStatus.FAILED &&
            r.claimedAt.getTime() <
              now.getTime() - r.attempts * KASHIA_WEBHOOK_REPLAY_BACKOFF_MS) ||
            (r.status === KashiaWebhookEventStatus.PROCESSING &&
              r.claimedAt.getTime() <
                now.getTime() - KASHIA_WEBHOOK_PROCESSING_STALE_MS)),
      )
      .slice(0, limit)
      .map(([webhookId, r]) => ({ webhookId, ...r }));
  }
}

describe("Kashia webhook (e2e)", () => {
  let app: INestApplication<App>;
  let events: FakeWebhookEventsRepository;
  let ordersService: {
    confirmOrderPayment: jest.Mock;
    handleEscrowEvent: jest.Mock;
  };

  const sign = (body: string) =>
    "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");

  // Provider-style formatting that JSON.stringify would not reproduce.
  const body = (webhookId: string) =>
    `{ "event": "escrow.active", "webhook_id": "${webhookId}", "timestamp": "2025-01-01T00:00:00Z", ` +
    `"data": { "id": "esc_1", "reference": "PL-1", "amount": 150000, "metadata": { "orderId": "order-1" } } }`;

  const post = (raw: string, signature = sign(raw)) =>
    request(app.getHttpServer())
      .post("/webhooks/kashia")
      .set("Content-Type", "application/json")
      .set("x-kashia-signature", signature)
      .send(raw);

  beforeAll(async () => {
    process.env.KASHIA_WEBHOOK_SECRET = SECRET;
    events = new FakeWebhookEventsRepository();
    ordersService = {
      confirmOrderPayment: jest.fn().mockResolvedValue({
        failed: false,
        code: 200,
        description: "Payment confirmed",
      }),
      handleEscrowEvent: jest
        .fn()
        .mockResolvedValue("order delivered: escrow completed"),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [KashiaWebhookController],
      providers: [
        KashiaWebhookService,
        { provide: KashiaWebhookEventsRepository, useValue: events },
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true, logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("verifies the signature over the raw bytes and confirms the order once", async () => {
    await post(body("wh_1")).expect(200);

    expect(ordersService.confirmOrderPayment).toHaveBeenCalledTimes(1);
    expect(ordersService.confirmOrderPayment).toHaveBeenCalledWith("order-1", {
      escrowId: "esc_1",
      escrowStatus: "active",
      paymentReference: "PL-1",
      amountKobo: 150000,
    });
    expect(events.records.get("wh_1")).toMatchObject({
      status: KashiaWebhookEventStatus.PROCESSED,
      outcome: "order confirmed",
      attempts: 1,
      deliveries: 1,
    });
  });

  it("acknowledges a redelivery without processing the payment again", async () => {
    await post(body("wh_1")).expect(200);

    expect(ordersService.confirmOrderPayment).toHaveBeenCalledTimes(1);
    expect(events.records.get("wh_1")).toMatchObject({ deliveries: 2 });
  });

  it("rejects a tampered body and an unsigned request", async () => {
    const raw = body("wh_2");
    await post(raw.replace("esc_1", "esc_9"), sign(raw)).expect(401);
    await request(app.getHttpServer())
      .post("/webhooks/kashia")
      .set("Content-Type", "application/json")
      .send(raw)
      .expect(401);

    expect(ordersService.confirmOrderPayment).toHaveBeenCalledTimes(1);
    expect(events.records.has("wh_2")).toBe(false);
  });

  it("answers 500 when handling fails, then processes the redelivery", async () => {
    ordersService.confirmOrderPayment.mockRejectedValueOnce(
      new Error("db down"),
    );

    await post(body("wh_3")).expect(500);
    expect(events.records.get("wh_3")).toMatchObject({
      status: KashiaWebhookEventStatus.FAILED,
      lastError: "db down",
      attempts: 1,
    });

    await post(body("wh_3")).expect(200);
    expect(ordersService.confirmOrderPayment).toHaveBeenCalledTimes(3);
    expect(events.records.get("wh_3")).toMatchObject({
      status: KashiaWebhookEventStatus.PROCESSED,
      attempts: 2,
      deliveries: 2,
    });
  });

  it("lets a signed escrow lifecycle event drive the order, with Kashia's event time", async () => {
    const raw =
      `{ "event": "escrow.completed", "webhook_id": "wh_life", "timestamp": "2025-01-02T08:30:00Z", ` +
      `"data": { "id": "esc_1", "reference": "PL-1", "status": "completed", "metadata": { "orderId": "order-1" } } }`;

    await post(raw).expect(200);

    expect(ordersService.handleEscrowEvent).toHaveBeenCalledWith("order-1", {
      event: "completed",
      escrowId: "esc_1",
      paymentReference: "PL-1",
      escrowStatus: "completed",
      occurredAt: new Date("2025-01-02T08:30:00Z"),
    });
    expect(events.records.get("wh_life")).toMatchObject({
      status: KashiaWebhookEventStatus.PROCESSED,
      outcome: "order delivered: escrow completed",
    });
  });

  it("answers 500 while the order keeps changing, so Kashia redelivers", async () => {
    ordersService.handleEscrowEvent.mockRejectedValueOnce(
      new Error("Order order-1 kept changing while applying escrow.disputed"),
    );
    const raw =
      `{ "event": "escrow.disputed", "webhook_id": "wh_busy", "timestamp": "2025-01-03T00:00:00Z", ` +
      `"data": { "id": "esc_1", "reference": "PL-1", "metadata": { "orderId": "order-1" } } }`;

    await post(raw).expect(500);
    expect(events.records.get("wh_busy")).toMatchObject({
      status: KashiaWebhookEventStatus.FAILED,
    });

    await post(raw).expect(200);
    expect(events.records.get("wh_busy")).toMatchObject({
      status: KashiaWebhookEventStatus.PROCESSED,
      attempts: 2,
    });
  });

  it("does not acknowledge a redelivery while the first attempt is running, so a failure is retried", async () => {
    let fail: (error: Error) => void = () => undefined;
    ordersService.confirmOrderPayment.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const calls = ordersService.confirmOrderPayment.mock.calls.length;

    // .then() sends it now (supertest requests are lazy).
    const first = post(body("wh_busy_1")).then((response) => response);
    await new Promise((resolve) => setTimeout(resolve, 200)); // mid-way
    const redelivery = await post(body("wh_busy_1"));
    fail(new Error("db blip"));
    const firstResponse = await first;

    expect(redelivery.status).toBe(503);
    expect(redelivery.headers["retry-after"]).toBe(
      String(KASHIA_WEBHOOK_IN_PROGRESS_RETRY_AFTER_S),
    );
    expect(firstResponse.status).toBe(500);
    expect(events.records.get("wh_busy_1")).toMatchObject({
      status: KashiaWebhookEventStatus.FAILED,
      attempts: 1,
    });

    // Kashia redelivers after the 503 and the event is handled.
    await post(body("wh_busy_1")).expect(200);
    expect(events.records.get("wh_busy_1")).toMatchObject({
      status: KashiaWebhookEventStatus.PROCESSED,
      attempts: 2,
      deliveries: 3,
    });
    expect(ordersService.confirmOrderPayment.mock.calls.length - calls).toBe(2);
  });

  it("recovers an event Kashia stops sending, by replaying the stored delivery", async () => {
    ordersService.confirmOrderPayment.mockRejectedValueOnce(
      new Error("db blip"),
    );
    await post(body("wh_lost")).expect(500);
    // Kashia never redelivers. Once the backoff has passed, the replay job
    // handles the stored (already verified) delivery.
    events.records.get("wh_lost")!.claimedAt = new Date(
      Date.now() - KASHIA_WEBHOOK_REPLAY_BACKOFF_MS - 1000,
    );

    const replayed = await app
      .get(KashiaWebhookService)
      .replayPendingDeliveries();

    expect(replayed).toMatchObject({ attempted: 1, recovered: 1 });
    expect(events.records.get("wh_lost")).toMatchObject({
      status: KashiaWebhookEventStatus.PROCESSED,
      outcome: "order confirmed",
      attempts: 2,
      deliveries: 1, // the replay is not a delivery from Kashia
    });
  });

  it("rejects a body that is not JSON", async () => {
    await post("{not json").expect(400);
  });
});
