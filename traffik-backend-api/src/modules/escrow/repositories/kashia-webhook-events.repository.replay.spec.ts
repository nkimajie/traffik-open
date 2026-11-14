import mongoose, { Model, Query } from "mongoose";
import { KashiaWebhookEventsRepository } from "./kashia-webhook-events.repository";
import {
  KashiaWebhookEventDocument,
  KashiaWebhookEventSchema,
} from "../schemas/kashia-webhook-event.schema";
import { KashiaWebhookEventStatus } from "../enums/kashia-webhook-event-status.enum";
import {
  KASHIA_WEBHOOK_PROCESSING_STALE_MS,
  KASHIA_WEBHOOK_REPLAY_BACKOFF_MS,
  KASHIA_WEBHOOK_REPLAY_MAX_ATTEMPTS,
} from "../constants/kashia-webhook.constant";

/**
 * The replay query against the real schema, cast by Mongoose but not sent to
 * a database.
 */
describe("KashiaWebhookEventsRepository.findReplayable (cast against the schema)", () => {
  const EventModel = mongoose.model(
    "KashiaWebhookEventReplayCastSpec",
    KashiaWebhookEventSchema,
  ) as unknown as Model<KashiaWebhookEventDocument>;
  const repository = new KashiaWebhookEventsRepository(EventModel);

  it("finds failed deliveries past their backoff and abandoned ones, under the attempt limit, oldest attempt first", async () => {
    let captured: { filter: any; options: any } | undefined;
    jest.spyOn(Query.prototype, "exec").mockImplementation(function (
      this: any,
    ) {
      this._castConditions();
      expect(this.error()).toBeFalsy();
      captured = { filter: this.getFilter(), options: this.getOptions() };
      return Promise.resolve([]);
    });
    const now = new Date("2026-03-01T12:00:00Z");

    await repository.findReplayable(now, 25);

    expect(captured!.filter).toEqual({
      attempts: { $lt: KASHIA_WEBHOOK_REPLAY_MAX_ATTEMPTS },
      $or: [
        {
          status: KashiaWebhookEventStatus.FAILED,
          // Waits the base backoff times the attempts so far.
          $expr: {
            $lt: [
              "$claimedAt",
              {
                $subtract: [
                  now,
                  {
                    $multiply: ["$attempts", KASHIA_WEBHOOK_REPLAY_BACKOFF_MS],
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
    });
    expect(captured!.options).toMatchObject({
      sort: { claimedAt: 1 },
      limit: 25,
    });
    jest.restoreAllMocks();
  });
});
