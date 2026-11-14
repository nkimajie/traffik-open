import { Context, Handler } from "aws-lambda";

/**
 * The scheduled Lambda entry points. lambda.ts keeps its application context
 * in module state, so each test loads a fresh copy of it with its own
 * NestFactory stand-in. (That copy has its own service classes, so they
 * are told apart by name.)
 */
describe("lambda scheduled entry points", () => {
  const sweeper = {
    sweep: jest
      .fn()
      .mockResolvedValue({ examined: 2, released: 1, complete: true }),
  };
  const replayer = {
    replay: jest
      .fn()
      .mockResolvedValue({ attempted: 1, recovered: 1, failed: 0, gaveUp: 0 }),
  };

  const load = () => {
    const context = {
      get: jest.fn((token: { name: string }) =>
        token.name === "AbandonedCheckoutsSweeperService" ? sweeper : replayer,
      ),
    };
    const createApplicationContext = jest.fn().mockResolvedValue(context);
    let lambda!: Record<string, Handler>;
    jest.isolateModules(() => {
      jest.doMock("@nestjs/core", () => ({
        ...jest.requireActual("@nestjs/core"),
        NestFactory: { createApplicationContext },
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      lambda = require("./lambda");
    });
    const invoke = (name: string) =>
      lambda[name]({}, {} as Context, () => undefined);
    return { context, createApplicationContext, invoke };
  };

  afterEach(() => {
    jest.dontMock("@nestjs/core");
    jest.clearAllMocks();
  });

  it("sweeps abandoned checkouts in an application context kept across warm invocations", async () => {
    const { context, createApplicationContext, invoke } = load();

    await expect(invoke("sweepAbandonedCheckouts")).resolves.toEqual({
      examined: 2,
      released: 1,
      complete: true,
    });
    sweeper.sweep.mockResolvedValueOnce(null);
    await expect(invoke("sweepAbandonedCheckouts")).resolves.toEqual({
      skipped: true,
    });

    expect(createApplicationContext).toHaveBeenCalledTimes(1); // no HTTP server
    expect(context.get.mock.calls[0][0].name).toBe(
      "AbandonedCheckoutsSweeperService",
    );
  });

  it("replays Kashia webhooks, sharing that context with the sweep", async () => {
    const { context, createApplicationContext, invoke } = load();

    await invoke("sweepAbandonedCheckouts");
    await expect(invoke("replayKashiaWebhooks")).resolves.toEqual({
      attempted: 1,
      recovered: 1,
      failed: 0,
      gaveUp: 0,
    });

    expect(createApplicationContext).toHaveBeenCalledTimes(1);
    expect(context.get.mock.calls[1][0].name).toBe(
      "KashiaWebhookReplayService",
    );
  });
});
