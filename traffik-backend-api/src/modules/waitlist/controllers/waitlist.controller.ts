import { Controller, Post, Body, HttpStatus, UsePipes } from "@nestjs/common";
import { WaitlistService } from "../services/waitlist.service";
import { CreateWaitlistDto } from "../dto/create-waitlist.dto";
import { JoiValidationPipe } from "../../../common/pipes/validation/joi_validate.pipe";
import { CreateWaitlistValidation } from "../validations/create-waitlist.validation";
import { ApiResponse } from "../../../common/interfaces/response.interface";
import {
  ApiTags,
  ApiBody,
  ApiResponse as ApiResponseDoc,
} from "@nestjs/swagger";
import { ApiPublicEndpoint } from "../../../common/decorators/api-audience.decorator";

@ApiTags("Waitlist")
@Controller("waitlist")
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @UsePipes(new JoiValidationPipe(CreateWaitlistValidation))
  @ApiPublicEndpoint({
    summary: "Join the pre-launch waitlist",
    description:
      "Captures an email address from the marketing site so the person can be notified at launch. Open by design — no account is needed.",
  })
  @ApiBody({ type: CreateWaitlistDto })
  @ApiResponseDoc({ status: 201, description: "Added to the waitlist" })
  @ApiResponseDoc({ status: 400, description: "Validation failed" })
  @ApiResponseDoc({
    status: 409,
    description: "Email is already on the waitlist",
  })
  async create(
    @Body() createWaitlistDto: CreateWaitlistDto,
  ): Promise<ApiResponse> {
    const data = await this.waitlistService.create(createWaitlistDto);
    return {
      status: HttpStatus.CREATED,
      message: "Successfully joined waitlist",
      data,
    };
  }
}
