import { Logger, RawBodyRequest } from "@nestjs/common";
import { Request, Response } from "express";
import { KashiaWebhookController } from "./kashia-webhook.controller";
import { KashiaWebhookService } from "../services/kashia-webhook.service";
import { KASHIA_WEBHOOK_IN_PROGRESS_RETRY_AFTER_S } from "../constants/kashia-webhook.constant";

describe("KashiaWebhookController", () => {
  const payload = {
    event: "escrow.active",
    webhook_id: "wh_1",
    timestamp: "2025-01-01T00:00:00Z",
    data: { id: "esc_1", reference: "PL-1", metadata: { orderId: "order-1" } },
  };
  const rawBody = Buffer.from(JSON.stringify(payload));

  let service: { verifySignature: jest.Mock; processEvent: jest.Mock };
  let controller: KashiaWebhookController;
  let logs: {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };

  const buildRequest = (body: Buffer | undefined = rawBody) =>
    ({
      rawBody: body,
      body: body ? JSON.parse(body.toString()) : undefined,
      ip: "203.0.113.9",
    }) as unknown as RawBodyRequest<Request>;

  const buildResponse = () => {
    const res = { status: jest.fn(), send: jest.fn(), set: jest.fn() };
    res.status.mockReturnValue(res);
    res.set.mockReturnValue(res);
    return res as unknown as Response & {
      status: jest.Mock;
      send: jest.Mock;
      set: jest.Mock;
    };
  };

  beforeEach(() => {
    service = {
      verifySignature: jest.fn().mockReturnValue(true),
      processEvent: jest.fn().mockResolvedValue({
        disposition: "processed",
        outcome: "order confirmed",
        attempt: 1,
      }),
    };
    controller = new KashiaWebhookController(
      service as unknown as KashiaWebhookService,
    );
    logs = {
      log: jest
        .spyOn(Logger.prototype, "log")
        .mockImplementation(() => undefined),
      warn: jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined),
      error: jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined),
    };
  });

  afterEach(() => jest.restoreAllMocks());

  it("answers 200 only after the event has been processed, and logs receipt and outcome", async () => {
    let processedBeforeResponse = false;
    service.processEvent.mockImplementation(async () => {
      processedBeforeResponse = true;
      return {
        disposition: "processed",
        outcome: "order confirmed",
        attempt: 1,
      };
    });
    const res = buildResponse();

    await controller.handleKashiaWebhook(buildRequest(), "sha256=abc", res);

    expect(processedBeforeResponse).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(service.verifySignature).toHaveBeenCalledWith(
      payload,
      "sha256=abc",
      rawBody,
    );

    const messages = logs.log.mock.calls.map((call) => String(call[0]));
    expect(messages[0]).toMatch(
      /received .*event=escrow\.active.*webhook_id=wh_1.*reference=PL-1.*escrow=esc_1.*order=order-1/,
    );
    expect(messages[1]).toMatch(
      /processed .*outcome=order confirmed.*attempt=1.*ms=\d+/,
    );
  });

  it("answers 200 for a duplicate delivery without re-processing", async () => {
    service.processEvent.mockResolvedValue({ disposition: "duplicate" });
    const res = buildResponse();

    await controller.handleKashiaWebhook(buildRequest(), "sha256=abc", res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(logs.log.mock.calls.map((c) => String(c[0]))[1]).toMatch(
      /duplicate/,
    );
  });

  it("answers 503 with Retry-After while an earlier delivery is still being handled, so Kashia redelivers", async () => {
    service.processEvent.mockResolvedValue({ disposition: "in_progress" });
    const res = buildResponse();

    await controller.handleKashiaWebhook(buildRequest(), "sha256=sig", res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.set).toHaveBeenCalledWith(
      "Retry-After",
      String(KASHIA_WEBHOOK_IN_PROGRESS_RETRY_AFTER_S),
    );
    expect(res.status).not.toHaveBeenCalledWith(200);
  });

  it("answers 500 when processing fails so Kashia redelivers, and logs the failure", async () => {
    service.processEvent.mockRejectedValue(new Error("db down"));
    const res = buildResponse();

    await controller.handleKashiaWebhook(buildRequest(), "sha256=abc", res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(String(logs.error.mock.calls[0][0])).toMatch(
      /processing failed .*webhook_id=wh_1.*will be retried/,
    );
  });

  it("answers 401 and logs when the signature is invalid, without processing", async () => {
    service.verifySignature.mockReturnValue(false);
    const res = buildResponse();

    await controller.handleKashiaWebhook(buildRequest(), undefined, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(service.processEvent).not.toHaveBeenCalled();
    expect(String(logs.warn.mock.calls[0][0])).toMatch(
      /invalid signature .*webhook_id=wh_1.*ip=203\.0\.113\.9.*signature=missing/,
    );
  });

  it("answers 400 and logs when the body is not JSON", async () => {
    const res = buildResponse();
    const req = {
      rawBody: Buffer.from("{not json"),
      ip: "203.0.113.9",
    } as unknown as RawBodyRequest<Request>;

    await controller.handleKashiaWebhook(req, "sha256=abc", res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.processEvent).not.toHaveBeenCalled();
    expect(String(logs.warn.mock.calls[0][0])).toMatch(
      /invalid JSON .*ip=203\.0\.113\.9/,
    );
  });
});
