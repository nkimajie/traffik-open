import { Controller, Get } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { AppService } from "./app.service";
import { ApiPublicEndpoint } from "./common/decorators/api-audience.decorator";

@ApiTags("Health")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiPublicEndpoint({
    summary: "Service health check",
    description:
      "Returns a plain-text liveness string. Used by infrastructure monitors and by clients to confirm the base URL is reachable.",
  })
  @ApiResponse({
    status: 200,
    description: "Service is running",
    schema: { type: "string", example: "Traffik API is running" },
  })
  getHello(): string {
    return this.appService.running();
  }
}
