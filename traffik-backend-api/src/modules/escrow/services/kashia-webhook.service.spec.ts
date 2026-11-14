import { Logger } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { KashiaWebhookService } from "./kashia-webhook.service";
import { KashiaWebhookEventsRepository } from "../repositories/kashia-webhook-events.repository";
import { OrdersService } from "src/modules/orders/services/orders.service";
import { OrderStatus } from "src/modules/orders/enums/order.enum";
import { KashiaWebhookPayload } from "../interfaces/kashia-webhook.interface";
import { KashiaWebhookEventStatus } from "../enums/kashia-webhook-event-status.enum";
import { KASHIA_WEBHOOK_REPLAY_MAX_ATTEMPTS } from "../constants/kashia-webhook.constant";

describe("KashiaWebhookService.processEvent", () => {
  let service: KashiaWebhookService;
  let repository: {
    claim: jest.Mock;
    markProcessed: jest.Mock;
    markFailed: jest.Mock;
    findReplayable: jest.Mock;
  };
  let ordersService: {
    confirmOrderPayment: jest.Mock;
    cancelPendingPaymentOrder: jest.Mock;
    updateOrderEscrowFields: jest.Mock;
    findOrderIdByPaymentReference: jest.Mock;
    recordEscrowRefunded: jest.Mock;
    handleEscrowEvent: jest.Mock;
  };

  const escrowActive: KashiaWebhookPayload = {
    event: "escrow.active",
    webhook_id: "wh_1",
    timestamp: "2025-01-01T00:00:00Z",
    data: {
      id: "esc_1",
      reference: "PL-1",
      amount: 150000,
      metadata: { orderId: "order-1" },
    },
  };

  beforeEach(async () => {
    repository = {
      claim: jest.fn().mockResolvedValue({ claimed: true, attempt: 1 }),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      findReplayable: jest.fn().mockResolvedValue([]),
    };
    ordersService = {
      confirmOrderPayment: jest.fn().mockResolvedValue({
        failed: false,
        code: 200,
        description: "Payment confirmed",
      }),
      cancelPendingPaymentOrder: jest.fn().mockResolvedValue({
        failed: false,
        description: "Pending payment order cancelled",
      }),
      updateOrderEscrowFields: jest.fn().mockResolvedValue(undefined),
      findOrderIdByPaymentReference: jest.fn().mockResolvedValue(undefined),
      recordEscrowRefunded: jest.fn().mockResolvedValue("completed"),
      handleEscrowEvent: jest
        .fn()
        .mockResolvedValue("escrow status mirrored: refunded"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KashiaWebhookService,
        { provide: KashiaWebhookEventsRepository, useValue: repository },
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();

    service = module.get<KashiaWebhookService>(KashiaWebhookService);
  });

  it("claims, handles and marks a first delivery as processed", async () => {
    await expect(service.processEvent(escrowActive)).resolves.toEqual({
      disposition: "processed",
      outcome: "order confirmed",
      attempt: 1,
    });

    expect(repository.claim).toHaveBeenCalledWith(
      "wh_1",
      "escrow.active",
      escrowActive,
      { reference: "PL-1", orderId: "order-1" },
      { countDelivery: true },
    );
    expect(ordersService.confirmOrderPayment).toHaveBeenCalledWith("order-1", {
      escrowId: "esc_1",
      escrowStatus: "active",
      paymentReference: "PL-1",
      amountKobo: 150000,
    });
    expect(repository.markProcessed).toHaveBeenCalledWith(
      "wh_1",
      "order confirmed",
    );
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("does not handle a duplicate delivery", async () => {
    repository.claim.mockResolvedValue({
      claimed: false,
      status: KashiaWebhookEventStatus.PROCESSED,
    });

    await expect(service.processEvent(escrowActive)).resolves.toEqual({
      disposition: "duplicate",
    });

    expect(ordersService.confirmOrderPayment).not.toHaveBeenCalled();
    expect(repository.markProcessed).not.toHaveBeenCalled();
  });

  it("does not acknowledge a delivery while an earlier one is still being handled", async () => {
    repository.claim.mockResolvedValue({
      claimed: false,
      status: KashiaWebhookEventStatus.PROCESSING,
    });

    await expect(service.processEvent(escrowActive)).resolves.toEqual({
      disposition: "in_progress",
    });
    expect(ordersService.confirmOrderPayment).not.toHaveBeenCalled();
  });

  it("marks a failed attempt and rethrows so the delivery is not acknowledged", async () => {
    const failure = new Error("db down");
    ordersService.confirmOrderPayment.mockRejectedValue(failure);

    await expect(service.processEvent(escrowActive)).rejects.toBe(failure);

    expect(repository.markFailed).toHaveBeenCalledWith("wh_1", failure);
    expect(repository.markProcessed).not.toHaveBeenCalled();
  });

  it("still rethrows the handler error if recording the failure also fails", async () => {
    ordersService.confirmOrderPayment.mockRejectedValue(new Error("db down"));
    repository.markFailed.mockRejectedValue(new Error("also down"));

    await expect(service.processEvent(escrowActive)).rejects.toThrow("db down");
  });

  it("reports a retry attempt when re-claiming a previously failed delivery", async () => {
    repository.claim.mockResolvedValue({ claimed: true, attempt: 3 });

    await expect(service.processEvent(escrowActive)).resolves.toMatchObject({
      disposition: "processed",
      attempt: 3,
    });
  });

  it("records the outcome when the order could not be confirmed", async () => {
    ordersService.confirmOrderPayment.mockResolvedValue({
      failed: true,
      code: 409,
      description: "Order was cancelled before payment was captured",
    });

    await expect(service.processEvent(escrowActive)).resolves.toMatchObject({
      outcome: "not confirmed: Order was cancelled before payment was captured",
    });
    // A business outcome is not a processing failure: no retry would help.
    expect(repository.markProcessed).toHaveBeenCalled();
  });

  it("processes a payload without webhook_id instead of dropping it", async () => {
    await expect(
      service.processEvent({
        ...escrowActive,
        webhook_id: undefined as unknown as string,
      }),
    ).resolves.toEqual({
      disposition: "processed",
      outcome: "order confirmed",
    });

    expect(repository.claim).not.toHaveBeenCalled();
    expect(ordersService.confirmOrderPayment).toHaveBeenCalled();
  });

  it("cancels the unpaid order on payment_link.expired", async () => {
    await expect(
      service.processEvent({
        ...escrowActive,
        webhook_id: "wh_2",
        event: "payment_link.expired",
      }),
    ).resolves.toMatchObject({ outcome: "Pending payment order cancelled" });

    expect(ordersService.cancelPendingPaymentOrder).toHaveBeenCalledWith(
      "order-1",
      "Payment link expired",
      // Only the order's current link may cancel it.
      { paymentReference: "PL-1", escrowStatus: "expired" },
    );
  });

  it("only mirrors escrow.created while the order is still unpaid", async () => {
    await service.processEvent({
      ...escrowActive,
      webhook_id: "wh_3",
      event: "escrow.created",
      data: {
        id: "esc_1",
        reference: "PL-1",
        status: "pending",
        metadata: { orderId: "order-1" },
      },
    });

    expect(ordersService.updateOrderEscrowFields).toHaveBeenCalledWith(
      "order-1",
      { escrowId: "esc_1", escrowStatus: "pending", paymentReference: "PL-1" },
      { onlyIfOrderStatus: OrderStatus.PENDING_PAYMENT },
    );
  });

  describe("escrow lifecycle events", () => {
    const lifecycle = (event: string, data: Record<string, unknown> = {}) =>
      ({
        ...escrowActive,
        webhook_id: `wh_${event}`,
        event,
        timestamp: "2026-03-01T10:00:00Z",
        data: {
          id: "esc_1",
          reference: "PL-1",
          metadata: { orderId: "order-1" },
          ...data,
        },
      }) as KashiaWebhookPayload;

    it.each([
      ["escrow.completed", "completed"],
      ["escrow.cancelled", "cancelled"],
      ["escrow.disputed", "disputed"],
      ["escrow.awaiting_confirmation", "awaiting_confirmation"],
    ])(
      "hands %s to the order with the escrow and when it happened",
      async (event, name) => {
        ordersService.handleEscrowEvent.mockResolvedValue("outcome");

        await expect(
          service.processEvent(lifecycle(event, { status: name })),
        ).resolves.toMatchObject({ outcome: "outcome" });

        expect(ordersService.handleEscrowEvent).toHaveBeenCalledWith(
          "order-1",
          {
            event: name,
            escrowId: "esc_1",
            paymentReference: "PL-1",
            escrowStatus: name,
            occurredAt: new Date("2026-03-01T10:00:00Z"),
          },
        );
        // The order's escrow fields are no longer overwritten blindly.
        expect(ordersService.updateOrderEscrowFields).not.toHaveBeenCalled();
      },
    );

    it("passes no event time when Kashia's timestamp is unusable", async () => {
      await service.processEvent({
        ...lifecycle("escrow.completed"),
        timestamp: "not a date",
      });

      expect(ordersService.handleEscrowEvent.mock.calls[0][1].occurredAt).toBe(
        undefined,
      );
    });

    it("finds the order by payment reference when metadata is missing", async () => {
      ordersService.findOrderIdByPaymentReference.mockResolvedValue("order-9");

      await service.processEvent(
        lifecycle("escrow.completed", { metadata: undefined }),
      );

      expect(ordersService.findOrderIdByPaymentReference).toHaveBeenCalledWith(
        "PL-1",
      );
      expect(ordersService.handleEscrowEvent.mock.calls[0][0]).toBe("order-9");
    });

    it("does nothing when the order cannot be resolved", async () => {
      await expect(
        service.processEvent(
          lifecycle("escrow.completed", { metadata: {}, reference: undefined }),
        ),
      ).resolves.toMatchObject({ outcome: "order not resolved" });

      expect(ordersService.handleEscrowEvent).not.toHaveBeenCalled();
    });

    it("lets a failure surface so Kashia redelivers", async () => {
      ordersService.handleEscrowEvent.mockRejectedValue(
        new Error("order kept changing"),
      );

      await expect(
        service.processEvent(lifecycle("escrow.completed")),
      ).rejects.toThrow("order kept changing");
      expect(repository.markFailed).toHaveBeenCalled();
    });
  });

  describe("escrow.refunded", () => {
    const escrowRefunded: KashiaWebhookPayload = {
      ...escrowActive,
      webhook_id: "wh_4",
      event: "escrow.refunded",
      data: {
        id: "esc_1",
        reference: "PL-1",
        status: "refunded",
        metadata: { orderId: "order-1" },
      },
    };

    it("closes the refund and applies the event to the order", async () => {
      const calls: string[] = [];
      ordersService.recordEscrowRefunded.mockImplementation(async () => {
        calls.push("refund");
        return "completed";
      });
      ordersService.handleEscrowEvent.mockImplementation(async () => {
        calls.push("order");
        return "order cancelled from PENDING: Kashia returned the payment to the shopper";
      });

      await expect(service.processEvent(escrowRefunded)).resolves.toMatchObject(
        {
          outcome:
            "order cancelled from PENDING: Kashia returned the payment to the shopper; refund completed",
        },
      );

      expect(calls).toEqual(["refund", "order"]);
      expect(ordersService.recordEscrowRefunded).toHaveBeenCalledWith(
        "order-1",
        { escrowId: "esc_1", paymentReference: "PL-1" },
      );
      expect(ordersService.handleEscrowEvent).toHaveBeenCalledWith(
        "order-1",
        expect.objectContaining({ event: "refunded", escrowId: "esc_1" }),
      );
    });

    it.each([
      ["confirmed", "manual refund confirmed by Kashia"],
      ["possible_double_refund", "possible double refund flagged"],
      ["unmatched", "no refund matched (remembered)"],
    ])(
      "records the %s outcome and acknowledges the delivery",
      async (outcome, text) => {
        ordersService.recordEscrowRefunded.mockResolvedValue(outcome);

        await expect(
          service.processEvent(escrowRefunded),
        ).resolves.toMatchObject({
          outcome: `escrow status mirrored: refunded; ${text}`,
        });
        expect(repository.markProcessed).toHaveBeenCalled();
      },
    );

    it("does nothing when the order cannot be resolved", async () => {
      await expect(
        service.processEvent({
          ...escrowRefunded,
          data: { id: "esc_1" },
        }),
      ).resolves.toMatchObject({ outcome: "order not resolved" });

      expect(ordersService.recordEscrowRefunded).not.toHaveBeenCalled();
      expect(ordersService.handleEscrowEvent).not.toHaveBeenCalled();
    });
  });

  describe("replayPendingDeliveries", () => {
    const record = (webhookId: string, attempts = 1) => ({
      webhookId,
      event: "escrow.active",
      attempts,
      reference: "PL-1",
      orderId: "order-1",
      payload: { ...escrowActive, webhook_id: webhookId },
    });
    let errorLog: jest.SpyInstance;
    let warnLog: jest.SpyInstance;

    beforeEach(() => {
      jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
      warnLog = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);
      errorLog = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    it("handles a failed delivery again from its stored payload, not counting it as a delivery", async () => {
      repository.findReplayable
        .mockResolvedValueOnce([record("wh_9")])
        .mockResolvedValue([]);
      repository.claim.mockResolvedValue({ claimed: true, attempt: 2 });

      const result = await service.replayPendingDeliveries();

      expect(result).toEqual({
        attempted: 1,
        recovered: 1,
        failed: 0,
        gaveUp: 0,
      });
      expect(repository.claim).toHaveBeenCalledWith(
        "wh_9",
        "escrow.active",
        expect.objectContaining({ webhook_id: "wh_9" }),
        { reference: "PL-1", orderId: "order-1" },
        { countDelivery: false },
      );
      expect(ordersService.confirmOrderPayment).toHaveBeenCalledTimes(1);
      expect(repository.markProcessed).toHaveBeenCalledWith(
        "wh_9",
        "order confirmed",
      );
    });

    it("leaves a delivery a Kashia redelivery is already handling", async () => {
      repository.findReplayable
        .mockResolvedValueOnce([record("wh_9")])
        .mockResolvedValue([]);
      repository.claim.mockResolvedValue({
        claimed: false,
        status: KashiaWebhookEventStatus.PROCESSING,
      });

      const result = await service.replayPendingDeliveries();

      expect(result.attempted).toBe(0);
      expect(ordersService.confirmOrderPayment).not.toHaveBeenCalled();
    });

    it("records a failure for a later retry, and gives up loudly at the attempt limit", async () => {
      repository.findReplayable
        .mockResolvedValueOnce([
          record("wh_again", 1),
          record("wh_last", KASHIA_WEBHOOK_REPLAY_MAX_ATTEMPTS - 1),
        ])
        .mockResolvedValue([]);
      repository.claim.mockResolvedValue({ claimed: true, attempt: 2 });
      ordersService.confirmOrderPayment.mockRejectedValue(new Error("db down"));

      const result = await service.replayPendingDeliveries();

      expect(result).toEqual({
        attempted: 2,
        recovered: 0,
        failed: 2,
        gaveUp: 1,
      });
      expect(repository.markFailed).toHaveBeenCalledTimes(2);
      expect(warnLog).toHaveBeenCalledWith(
        expect.stringMatching(/wh_again.*failed again: db down/),
      );
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringMatching(/wh_last .*no more automatic retries/),
      );
    });

    it("does not replay the same delivery twice in one run", async () => {
      repository.findReplayable.mockResolvedValue([record("wh_9")]);
      repository.claim.mockResolvedValue({ claimed: true, attempt: 2 });
      ordersService.confirmOrderPayment.mockRejectedValue(new Error("db down"));

      const result = await service.replayPendingDeliveries();

      expect(result.attempted).toBe(1);
      expect(repository.findReplayable).toHaveBeenCalledTimes(2);
    });

    it("stops at its time budget", async () => {
      repository.findReplayable.mockResolvedValue([record("wh_9")]);

      const result = await service.replayPendingDeliveries({
        timeBudgetMs: 0,
      });

      expect(result.attempted).toBe(0);
      expect(repository.findReplayable).not.toHaveBeenCalled();
    });
  });
});
