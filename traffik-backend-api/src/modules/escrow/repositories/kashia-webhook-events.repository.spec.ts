import { Model } from "mongoose";
import { KashiaWebhookEventsRepository } from "./kashia-webhook-events.repository";
import { KashiaWebhookEventDocument } from "../schemas/kashia-webhook-event.schema";
import { KashiaWebhookEventStatus } from "../enums/kashia-webhook-event-status.enum";
import { KASHIA_WEBHOOK_PROCESSING_STALE_MS } from "../constants/kashia-webhook.constant";

describe("KashiaWebhookEventsRepository", () => {
  const duplicateKey = Object.assign(new Error("E11000 duplicate key"), {
    code: 11000,
  });

  const buildRepository = (model: Partial<Record<string, jest.Mock>>) =>
    new KashiaWebhookEventsRepository(
      model as unknown as Model<KashiaWebhookEventDocument>,
    );

  describe("claim", () => {
    it("records a first delivery as processing and claims it", async () => {
      const model = { create: jest.fn().mockResolvedValue({}) };

      await expect(
        buildRepository(model).claim(
          "wh_1",
          "escrow.active",
          {},
          {
            reference: "PL-1",
            orderId: "order-1",
          },
        ),
      ).resolves.toEqual({ claimed: true, attempt: 1 });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookId: "wh_1",
          event: "escrow.active",
          reference: "PL-1",
          orderId: "order-1",
          status: KashiaWebhookEventStatus.PROCESSING,
          attempts: 1,
          deliveries: 1,
        }),
      );
    });

    it("does not claim a redelivery of a processed webhook, but counts it", async () => {
      const model = {
        create: jest.fn().mockRejectedValue(duplicateKey),
        findOneAndUpdate: jest
          .fn()
          // retry filter (failed / stale) matches nothing
          .mockResolvedValueOnce(null)
          // duplicate counter
          .mockResolvedValueOnce({
            status: KashiaWebhookEventStatus.PROCESSED,
            deliveries: 2,
          }),
      };

      await expect(
        buildRepository(model).claim("wh_1", "escrow.active", {}),
      ).resolves.toEqual({
        claimed: false,
        status: KashiaWebhookEventStatus.PROCESSED,
      });

      expect(model.findOneAndUpdate).toHaveBeenLastCalledWith(
        { webhookId: "wh_1" },
        {
          $set: { lastDeliveredAt: expect.any(Date) },
          $inc: { deliveries: 1 },
        },
        { new: true },
      );
    });

    it("re-claims a redelivery of a failed webhook as a retry", async () => {
      const model = {
        create: jest.fn().mockRejectedValue(duplicateKey),
        findOneAndUpdate: jest.fn().mockResolvedValueOnce({ attempts: 2 }),
      };

      await expect(
        buildRepository(model).claim("wh_1", "escrow.active", {}),
      ).resolves.toEqual({ claimed: true, attempt: 2 });

      const [filter, update] = model.findOneAndUpdate.mock.calls[0];
      expect(filter.webhookId).toBe("wh_1");
      expect(filter.$or).toEqual([
        { status: KashiaWebhookEventStatus.FAILED },
        {
          status: KashiaWebhookEventStatus.PROCESSING,
          claimedAt: { $lt: expect.any(Date) },
        },
      ]);
      // Stale cut-off sits the configured distance in the past.
      const cutoff = (filter.$or[1].claimedAt.$lt as Date).getTime();
      expect(Date.now() - cutoff).toBeGreaterThanOrEqual(
        KASHIA_WEBHOOK_PROCESSING_STALE_MS - 1000,
      );
      expect(update).toEqual({
        $set: expect.objectContaining({
          status: KashiaWebhookEventStatus.PROCESSING,
        }),
        $inc: { attempts: 1, deliveries: 1 },
      });
    });

    it("re-claims for a replay without counting it as a delivery from Kashia", async () => {
      const model = {
        create: jest.fn().mockRejectedValue(duplicateKey),
        findOneAndUpdate: jest.fn().mockResolvedValueOnce({ attempts: 3 }),
      };

      await expect(
        buildRepository(model).claim(
          "wh_1",
          "escrow.active",
          {},
          {},
          { countDelivery: false },
        ),
      ).resolves.toEqual({ claimed: true, attempt: 3 });

      const [, update] = model.findOneAndUpdate.mock.calls[0];
      expect(update.$inc).toEqual({ attempts: 1, deliveries: 0 });
      expect(update.$set.lastDeliveredAt).toBeUndefined();
    });

    it("reports a delivery still being processed elsewhere as not claimed, with its status", async () => {
      const model = {
        create: jest.fn().mockRejectedValue(duplicateKey),
        findOneAndUpdate: jest
          .fn()
          .mockResolvedValueOnce(null) // not failed, not stale
          .mockResolvedValueOnce({
            status: KashiaWebhookEventStatus.PROCESSING,
          }),
      };

      await expect(
        buildRepository(model).claim("wh_1", "escrow.active", {}),
      ).resolves.toEqual({
        claimed: false,
        status: KashiaWebhookEventStatus.PROCESSING,
      });
    });

    it("surfaces database errors other than duplicate key", async () => {
      const model = {
        create: jest.fn().mockRejectedValue(new Error("connection lost")),
      };

      await expect(
        buildRepository(model).claim("wh_1", "escrow.active", {}),
      ).rejects.toThrow("connection lost");
    });
  });

  it("markProcessed stores the outcome and clears any previous error", async () => {
    const model = { updateOne: jest.fn().mockResolvedValue({}) };

    await buildRepository(model).markProcessed("wh_1", "order confirmed");

    expect(model.updateOne).toHaveBeenCalledWith(
      { webhookId: "wh_1" },
      {
        $set: {
          status: KashiaWebhookEventStatus.PROCESSED,
          processedAt: expect.any(Date),
          outcome: "order confirmed",
        },
        $unset: { lastError: "" },
      },
    );
  });

  it("markFailed keeps the record and notes the error", async () => {
    const model = { updateOne: jest.fn().mockResolvedValue({}) };

    await buildRepository(model).markFailed("wh_1", new Error("db down"));

    expect(model.updateOne).toHaveBeenCalledWith(
      { webhookId: "wh_1" },
      {
        $set: { status: KashiaWebhookEventStatus.FAILED, lastError: "db down" },
      },
    );
    expect(model.updateOne.mock.calls[0][1].$unset).toBeUndefined();
  });
});
