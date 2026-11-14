import { Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { Test } from "@nestjs/testing";
import { ScheduleModule } from "@nestjs/schedule";
import { AbandonedCheckoutsSweeperService } from "./abandoned-checkouts-sweeper.service";
import { OrdersService } from "./orders.service";

describe("AbandonedCheckoutsSweeperService", () => {
  let ordersService: { sweepAbandonedCheckouts: jest.Mock };
  let sweeper: AbandonedCheckoutsSweeperService;
  const lambdaName = process.env.AWS_LAMBDA_FUNCTION_NAME;

  beforeEach(() => {
    ordersService = {
      sweepAbandonedCheckouts: jest
        .fn()
        .mockResolvedValue({ examined: 3, released: 1, complete: true }),
    };
    sweeper = new AbandonedCheckoutsSweeperService(
      ordersService as unknown as OrdersService,
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
        AbandonedCheckoutsSweeperService,
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();
    await moduleRef.init();

    const job = moduleRef
      .get(SchedulerRegistry)
      .getCronJob("sweep-abandoned-checkouts");
    expect(String(job.cronTime.source)).toBe("0 */5 * * * *");

    await moduleRef.close();
  });

  it("sweeps on schedule in a long-running server", async () => {
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;

    await sweeper.runScheduled();

    expect(ordersService.sweepAbandonedCheckouts).toHaveBeenCalledTimes(1);
  });

  it("stands down on Lambda, where the scheduled function sweeps instead", async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = "traffik-backend-api-prod-api";

    await sweeper.runScheduled();

    expect(ordersService.sweepAbandonedCheckouts).not.toHaveBeenCalled();
  });

  it("returns what the sweep did", async () => {
    await expect(sweeper.sweep()).resolves.toEqual({
      examined: 3,
      released: 1,
      complete: true,
    });
  });

  it("does not start a sweep while one is still running", async () => {
    let finish: () => void = () => undefined;
    ordersService.sweepAbandonedCheckouts.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ examined: 0, released: 0, complete: true });
        }),
    );

    const first = sweeper.sweep();
    const overlapping = await sweeper.sweep();
    finish();
    await first;
    await sweeper.sweep();

    expect(overlapping).toBeNull();
    expect(ordersService.sweepAbandonedCheckouts).toHaveBeenCalledTimes(2);
  });

  it("logs a failed sweep instead of throwing, and runs again next time", async () => {
    ordersService.sweepAbandonedCheckouts.mockRejectedValueOnce(
      new Error("db down"),
    );

    await expect(sweeper.sweep()).resolves.toBeNull();
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining("db down"),
    );
    await expect(sweeper.sweep()).resolves.toMatchObject({ released: 1 });
  });
});
