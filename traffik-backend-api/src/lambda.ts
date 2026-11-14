import { Handler, Context } from "aws-lambda";
import { INestApplicationContext } from "@nestjs/common";
import { configure } from "@vendia/serverless-express"; // FIXED HERE
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { setupSwagger } from "./config/swagger.config";
import { AbandonedCheckoutsSweeperService } from "./modules/orders/services/abandoned-checkouts-sweeper.service";
import { KashiaWebhookReplayService } from "./modules/escrow/services/kashia-webhook-replay.service";

let server: Handler;
let jobsContext: INestApplicationContext | undefined;

async function bootstrap(): Promise<Handler> {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  setupSwagger(app);

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  return configure({
    app: expressApp,
    binaryMimeTypes: [
      "multipart/form-data",
      "application/octet-stream",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/*",
      "audio/*",
      "*/*",
    ],
  }); // FIXED HERE
}

export const handler: Handler = async (
  event: any,
  context: Context,
  callback: any,
) => {
  server = server ?? (await bootstrap());
  return server(event, context, callback);
};

/**
 * Scheduled (EventBridge) entry point: puts stock held by abandoned checkouts
 * back on sale. In-process cron timers do not fire reliably on Lambda, so
 * serverless.yml invokes this on a schedule. Reuses the application context
 * across warm invocations; no HTTP server is started.
 */
export const sweepAbandonedCheckouts: Handler = async () => {
  const result = await (await getJobsContext())
    .get(AbandonedCheckoutsSweeperService)
    .sweep();
  return result ?? { skipped: true };
};

/**
 * Scheduled (EventBridge) entry point: replays Kashia webhook deliveries that
 * failed or were left half-done (see KashiaWebhookReplayService).
 */
export const replayKashiaWebhooks: Handler = async () => {
  const result = await (await getJobsContext())
    .get(KashiaWebhookReplayService)
    .replay();
  return result ?? { skipped: true };
};

/** The application context for scheduled jobs, kept across warm invocations. */
async function getJobsContext(): Promise<INestApplicationContext> {
  jobsContext =
    jobsContext ?? (await NestFactory.createApplicationContext(AppModule));
  return jobsContext;
}
