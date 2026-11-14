import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ApiAdminEndpoint } from "src/common/decorators/api-audience.decorator";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import RoleGuard from "src/common/guards/roles.guard";
import { UserRole } from "src/modules/users/enums/user-role.enum";
import { JoiValidationPipe } from "src/common/pipes/validation/joi_validate.pipe";
import { BaseController } from "src/modules/shared/base/controller.base";
import { Response } from "express";
import { AdminEmailService } from "../services/admin-email.service";
import {
  EmailConfigStatusDto,
  EmailTemplateListItemDto,
  SendTestEmailDto,
  SendTestEmailResultDto,
} from "../dto/send-test-email.dto";
import { SendTestEmailValidation } from "../validations/send-test-email.validation";

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("admin/email")
export class AdminEmailController extends BaseController {
  constructor(private readonly adminEmailService: AdminEmailService) {
    super();
  }

  @Get("templates")
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "List email templates available for testing",
    description:
      "Returns the catalog of every transactional email the platform can send (OTP, welcome, order updates, vendor notifications, and so on). " +
      "Each item includes a stable `id`, a display `label`, and a short `description`. " +
      "Use the `id` values with `POST /admin/email/test` from the admin **Settings → Test emails** screen. " +
      "Response shape: `{ status, message, data: EmailTemplateListItem[] }`.",
  })
  @ApiResponse({
    status: 200,
    description:
      "Catalog returned in `data`. Nine templates are available when all email types are registered.",
    type: [EmailTemplateListItemDto],
  })
  async listTemplates(@Res() res: Response) {
    const templates = this.adminEmailService.listTemplates();
    return this.successResponse(res, "Email templates retrieved", templates);
  }

  @Get("config")
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "Get SMTP configuration status",
    description:
      "Shows whether outbound email is configured on this API instance and which from-address will be used for test sends and production mail. " +
      "Secrets (`SMTP_PASSWORD`, API keys) are **never** returned — only a boolean `configured` flag plus optional `fromEmail` and `fromName`. " +
      "The admin settings screen uses this to disable the test form when SMTP is missing. " +
      "Response shape: `{ status, message, data: EmailConfigStatusDto }`.",
  })
  @ApiResponse({
    status: 200,
    description:
      "`data.configured` is true when `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASSWORD` are all non-empty.",
    type: EmailConfigStatusDto,
  })
  async getConfigStatus(@Res() res: Response) {
    const config = this.adminEmailService.getConfigStatus();
    return this.successResponse(res, "Email config retrieved", config);
  }

  @Post("test")
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "Send a test email",
    description:
      "Renders one transactional template with **sample fixture data** and delivers it to the given address so admins can verify SMTP connectivity, subject lines, and HTML formatting before go-live. " +
      "Does not mutate any user, vendor, or order records. " +
      "Requires SMTP to be configured (`GET /admin/email/config`). " +
      "On failure (invalid recipient, SMTP error), returns HTTP 400 with `{ status, message }` and no `data`. " +
      "On success, `data` includes the resolved subject and `sentAt` timestamp.",
  })
  @ApiBody({ type: SendTestEmailDto })
  @ApiResponse({
    status: 200,
    description: "Message accepted by the mail transport.",
    type: SendTestEmailResultDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Validation failed (invalid email or unknown template id) or SMTP rejected the send.",
  })
  async sendTestEmail(
    @Body(new JoiValidationPipe(SendTestEmailValidation))
    dto: SendTestEmailDto,
    @Res() res: Response,
  ) {
    try {
      const result = await this.adminEmailService.sendTestEmail(
        dto.to,
        dto.template,
      );
      return this.successResponse(res, "Test email sent successfully", result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send test email";
      return this.throwErrorRaw(message, 400);
    }
  }
}
