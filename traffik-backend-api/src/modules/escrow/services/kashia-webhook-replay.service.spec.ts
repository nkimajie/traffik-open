import { Logger } from "@nestjs/common";
import { ScheduleModule, SchedulerRegistry } from "@nestjs/schedule";
import { Test } from "@nestjs/testing";
import { KashiaWebhookReplayService } from "./kashia-webhook-replay.service";
import { KashiaWebhookService } from "./kashia-webhook.service";

describe("KashiaWebhookReplayService", () => {
  let webhookService: { replayPendingDeliveries: jest.Mock };
  let replayer: KashiaWebhookReplayService;
  const lambdaName = process.env.AWS_LAMBDA_FUNCTION_NAME;
  const summary = { attempted: 2, recovered: 1, failed: 1, gaveUp: 0 };

  beforeEach(() => {
    webhookService = {
      replayPendingDeliveries: jest.fn().mockResolvedValue(summary),
    };
    replayer = new KashiaWebhookReplayService(
      webhookService as unknown as KashiaWebhookService,
    );
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (lambdaName === undefined) delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    else process.env.AWS_LAMBDA_FUNCTION_NAME = lambdaName;
  });

  it("is registered to run every five minutes", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        KashiaWebhookReplayService,
        { provide: KashiaWebhookService, useValue: webhookService },
      ],
    }).compile();
    await moduleRef.init();

    const job = moduleRef
      .get(SchedulerRegistry)
      .getCronJob("replay-kashia-webhooks");
    expect(String(job.cronTime.source)).toBe("0 */5 * * * *");

    await moduleRef.close();
  });

  it("replays on schedule in a long-running server", async () => {
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;

    await replayer.runScheduled();

    expect(webhookService.replayPendingDeliveries).toHaveBeenCalledTimes(1);
  });

  it("stands down on Lambda, where the scheduled function replays instead", async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = "traffik-backend-api-prod-api";

    await replayer.runScheduled();

    expect(webhookService.replayPendingDeliveries).not.toHaveBeenCalled();
  });

  it("does not start a run while one is still going", async () => {
    let finish: () => void = () => undefined;
    webhookService.replayPendingDeliveries.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(summary);
        }),
    );

    const first = replayer.replay();
    const overlapping = await replayer.replay();
    finish();

    await expect(first).resolves.toEqual(summary);
    expect(overlapping).toBeNull();
  });

  it("logs a failed run instead of throwing, and runs again next time", async () => {
    webhookService.replayPendingDeliveries.mockRejectedValueOnce(
      new Error("db down"),
    );

    await expect(replayer.replay()).resolves.toBeNull();
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining("db down"),
    );
    await expect(replayer.replay()).resolves.toEqual(summary);
  });
});
