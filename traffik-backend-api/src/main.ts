import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Config } from "./config/configuration";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { setupSwagger, swaggerPath } from "./config/swagger.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // An explicit allow-list: `true` in this array allowed every origin (with
  // credentials), which made the list meaningless.
  const extraCorsOrigins = (Config.getValue("CORS_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      ...extraCorsOrigins,
    ],
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "Authorization",
      "X-Requested-With",
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor());

  setupSwagger(app);

  const port = Config.getValue("PORT") || 3000;
  await app.listen(port);
  console.log(`Application is running on port ${port}`);
  console.log(
    `Swagger documentation available at http://localhost:${port}/${swaggerPath}`,
  );
}
bootstrap();
