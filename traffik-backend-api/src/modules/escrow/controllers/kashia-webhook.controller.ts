import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  Res,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Request, Response } from "express";
import { KashiaWebhookPayload } from "../interfaces/kashia-webhook.interface";
import { KashiaWebhookService } from "../services/kashia-webhook.service";
import { resolveOrderIdFromMetadata } from "../utils/kashia-webhook.util";
import { KASHIA_WEBHOOK_IN_PROGRESS_RETRY_AFTER_S } from "../constants/kashia-webhook.constant";

@ApiExcludeController()
@Controller("webhooks")
export class KashiaWebhookController {
  private readonly logger = new Logger(KashiaWebhookController.name);

  constructor(private readonly kashiaWebhookService: KashiaWebhookService) {}

  /**
   * Kashia retries deliveries that do not get a 2xx, so the outcome of handling
   * decides the response: 200 once the event is handled (or was already
   * handled), 500 if handling failed, and 503 with Retry-After while an
   * earlier delivery of the same event is still being handled (it may yet
   * fail, so this one is not acknowledged). Processing is awaited rather than
   * fire-and-forget because on Lambda nothing runs after the response is sent.
   */
  @Post("kashia")
  @HttpCode(200)
  async handleKashiaWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-kashia-signature") signature: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const startedAt = Date.now();
    let payload: KashiaWebhookPayload;

    try {
      payload = this.parsePayload(req);
    } catch {
      this.logger.warn(
        `Kashia webhook rejected: invalid JSON (ip=${req.ip}, bytes=${this.getRawBody(req)?.length ?? 0})`,
      );
      res.status(400).send("Invalid JSON");
      return;
    }

    const summary = this.describe(payload);

    if (
      !this.kashiaWebhookService.verifySignature(
        payload,
        signature,
        this.getRawBody(req),
      )
    ) {
      this.logger.warn(
        `Kashia webhook rejected: invalid signature (${summary}, ip=${req.ip}, signature=${signature ? "present" : "missing"})`,
      );
      res.status(401).send("Invalid signature");
      return;
    }

    this.logger.log(`Kashia webhook received (${summary})`);

    try {
      const result = await this.kashiaWebhookService.processEvent(payload);
      this.logger.log(
        `Kashia webhook ${result.disposition} (${summary}, outcome=${result.outcome ?? "n/a"}, attempt=${result.attempt ?? 1}, ms=${Date.now() - startedAt})`,
      );
      if (result.disposition === "in_progress") {
        res
          .status(503)
          .set("Retry-After", String(KASHIA_WEBHOOK_IN_PROGRESS_RETRY_AFTER_S))
          .send("An earlier delivery of this event is still being processed");
        return;
      }
      res.status(200).send("OK");
    } catch (error) {
      this.logger.error(
        `Kashia webhook processing failed (${summary}, ms=${Date.now() - startedAt}); will be retried on redelivery`,
        error instanceof Error ? error.stack : String(error),
      );
      res.status(500).send("Processing failed");
    }
  }

  /** Identifying fields for log lines; never the full payload. */
  private describe(payload: KashiaWebhookPayload): string {
    const data = payload.data ?? {};
    return [
      `event=${payload.event}`,
      `webhook_id=${payload.webhook_id ?? "n/a"}`,
      `reference=${data.reference ?? "n/a"}`,
      `escrow=${data.id ?? "n/a"}`,
      `order=${resolveOrderIdFromMetadata(data.metadata) ?? "n/a"}`,
    ].join(", ");
  }

  /** The exact bytes Kashia sent, when the body arrived unparsed or rawBody is enabled. */
  private getRawBody(
    req: RawBodyRequest<Request>,
  ): Buffer | string | undefined {
    if (req.rawBody?.length) {
      return req.rawBody;
    }
    return typeof req.body === "string" ? req.body : undefined;
  }

  private parsePayload(req: RawBodyRequest<Request>): KashiaWebhookPayload {
    if (req.rawBody?.length) {
      return JSON.parse(req.rawBody.toString("utf8")) as KashiaWebhookPayload;
    }

    if (typeof req.body === "string") {
      return JSON.parse(req.body) as KashiaWebhookPayload;
    }

    if (req.body && typeof req.body === "object") {
      return req.body as KashiaWebhookPayload;
    }

    throw new Error("Empty webhook body");
  }
}
