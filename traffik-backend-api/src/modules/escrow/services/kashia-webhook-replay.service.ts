import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { KashiaWebhookService } from "./kashia-webhook.service";
import { KashiaWebhookReplayResult } from "../interfaces/kashia-webhook-result.interface";

/**
 * Replays Kashia webhook deliveries that failed or were left half-done, on a
 * schedule, so a payment event is not lost when Kashia stops redelivering it
 * (e.g. after it was told a redelivery was handled while the first attempt
 * was still running, or its retries ran out).
 *
 * Runs every five minutes in a long-running server. On AWS Lambda, in-process
 * timers do not fire reliably, so serverless.yml invokes {@link replay} from a
 * scheduled function instead and the in-process job stands down.
 */
@Injectable()
export class KashiaWebhookReplayService {
  private readonly logger = new Logger(KashiaWebhookReplayService.name);
  private running = false;

  constructor(private readonly kashiaWebhookService: KashiaWebhookService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: "replay-kashia-webhooks" })
  async runScheduled(): Promise<void> {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return;
    }
    await this.replay();
  }

  /**
   * One replay run. Never throws: a failed run is logged and the next one
   * picks up where it stopped. A run still going when the next is due is not
   * overlapped.
   *
   * @returns what the run did, or null if it did not run or failed.
   */
  async replay(): Promise<KashiaWebhookReplayResult | null> {
    if (this.running) {
      this.logger.warn(
        "Kashia webhook replay still running; skipping this run",
      );
      return null;
    }

    this.running = true;
    try {
      return await this.kashiaWebhookService.replayPendingDeliveries();
    } catch (error) {
      this.logger.error(
        `Kashia webhook replay failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      this.running = false;
    }
  }
}
