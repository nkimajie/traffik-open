import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrdersService } from "./orders.service";
import { AbandonedCheckoutSweepResult } from "../interfaces/order-inventory.interface";

/**
 * Puts stock held by abandoned checkouts back on sale on a schedule.
 *
 * Without it, stale holds were only released when a checkout ran short of
 * that stock, which add-to-cart's stock check prevents once holds take the
 * visible stock to zero: products could look sold out indefinitely.
 *
 * Runs every five minutes in a long-running server. On AWS Lambda, in-process
 * timers do not fire reliably, so serverless.yml invokes {@link sweep} from a
 * scheduled function instead and the in-process job stands down.
 */
@Injectable()
export class AbandonedCheckoutsSweeperService {
  private readonly logger = new Logger(AbandonedCheckoutsSweeperService.name);
  private running = false;

  constructor(private readonly ordersService: OrdersService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: "sweep-abandoned-checkouts" })
  async runScheduled(): Promise<void> {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return;
    }
    await this.sweep();
  }

  /**
   * One sweep. Never throws: a failed run is logged and the next one picks
   * up where it stopped. A run still going when the next is due is not
   * overlapped.
   *
   * @returns what the sweep did, or null if it did not run or failed.
   */
  async sweep(): Promise<AbandonedCheckoutSweepResult | null> {
    if (this.running) {
      this.logger.warn(
        "Abandoned checkout sweep still running; skipping this run",
      );
      return null;
    }

    this.running = true;
    try {
      return await this.ordersService.sweepAbandonedCheckouts();
    } catch (error) {
      this.logger.error(
        `Abandoned checkout sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      this.running = false;
    }
  }
}
