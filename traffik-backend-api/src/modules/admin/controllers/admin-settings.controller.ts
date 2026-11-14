import { Body, Controller, Get, Patch, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ApiAdminEndpoint } from "src/common/decorators/api-audience.decorator";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import RoleGuard from "src/common/guards/roles.guard";
import { UserRole } from "src/modules/users/enums/user-role.enum";
import { JoiValidationPipe } from "src/common/pipes/validation/joi_validate.pipe";
import { BaseController } from "src/modules/shared/base/controller.base";
import { Response } from "express";
import {
  PlatformSettingsDto,
  UpdatePlatformSettingsDto,
} from "../dto/platform-settings.dto";
import { PlatformSettingsService } from "../services/platform-settings.service";
import { UpdatePlatformSettingsValidation } from "../validations/update-platform-settings.validation";

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard([UserRole.ADMIN]))
@Controller("admin/settings")
export class AdminSettingsController extends BaseController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {
    super();
  }

  @Get()
  @ApiAdminEndpoint({
    summary: "Get platform settings",
    description:
      "Returns editable platform configuration for the admin console, including the Kashia marketplace commission percentage.",
  })
  @ApiResponse({ status: 200, type: PlatformSettingsDto })
  async getSettings(@Res() res: Response) {
    const result = await this.platformSettingsService.getSettings();
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Patch()
  @ApiAdminEndpoint({
    summary: "Update platform settings",
    description:
      "Updates platform-wide settings. `commissionPercentage` is sent to Kashia as `merchant_fee_percentage` on every new payment link. Use `0` to disable Traffik's marketplace cut.",
  })
  @ApiBody({ type: UpdatePlatformSettingsDto })
  @ApiResponse({ status: 200, type: PlatformSettingsDto })
  async updateSettings(
    @Body(new JoiValidationPipe(UpdatePlatformSettingsValidation))
    dto: UpdatePlatformSettingsDto,
    @Res() res: Response,
  ) {
    const result = await this.platformSettingsService.updateSettings(dto);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }
}
