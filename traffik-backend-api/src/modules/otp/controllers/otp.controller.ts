import {
  Controller,
  Post,
  Body,
  Req,
  HttpException,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiResponse as ApiResponseDoc,
  ApiTags,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { OtpService } from "../services/otp.service";
import { UserRole } from "../../users/enums/user-role.enum";
import { ApiResponse } from "../../../common/interfaces/response.interface";
import { ApiEndpoint, ApiAudience } from "../../../common/decorators/api-audience.decorator";
import { VerifyOtpDto } from "../dto/verify-otp.dto";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import RolesGuard from "../../../common/guards/roles.guard";
import { OTP_RESEND_COOLDOWN_SECONDS } from "../constants/otp.constant";

@ApiTags("Email verification")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("otp")
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post("verify")
  @ApiEndpoint({
    audience: [ApiAudience.SHOPPER, ApiAudience.VENDOR],
    summary: "Verify an email one-time password",
    description:
      "Confirms ownership of the email address on the **authenticated** account by checking the four-digit code. " +
      "Sets `isVerified: true` on the shopper (`users`) or vendor (`vendors`) record matching the JWT subject. " +
      "Vendors use this during onboarding step **Email verification** (`/create-business/step0`) before business details. " +
      "Shoppers must verify before certain account actions if signup left them unverified. " +
      "Request body: `{ token: \"1234\" }`. " +
      "Returns `{ status: 200, message: \"Email verified successfully\" }` on success.",
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponseDoc({ status: 200, description: "Email verified successfully" })
  @ApiResponseDoc({
    status: 400,
    description:
      "Code is invalid, already used, or expired, or too many incorrect attempts were made (request a new code)",
  })
  async verifyOtp(
    @Req() req,
    @Body("token") token: string,
  ): Promise<ApiResponse> {
    const isValid = await this.otpService.verifyOtp(
      req.user._id,
      token,
      req.user.role,
    );

    if (!isValid) {
      // A real 400 (as documented above): returning it in a 2xx body let
      // clients treat a wrong code as a successful verification.
      throw new HttpException("Invalid OTP", HttpStatus.BAD_REQUEST);
    }

    return {
      status: HttpStatus.OK,
      message: "Email verified successfully",
    };
  }

  @Post("resend")
  @UseGuards(RolesGuard([UserRole.USER, UserRole.VENDOR]))
  @ApiEndpoint({
    audience: [ApiAudience.SHOPPER, ApiAudience.VENDOR],
    summary: "Request or resend a verification code",
    description:
      "Generates a fresh four-digit OTP, stores it for one hour, and emails it to the address on the authenticated account. " +
      "**Vendors** call this explicitly from the onboarding **Request OTP** button — codes are not sent automatically at vendor signup or login. " +
      "**Shoppers** may receive a code automatically at signup; use this endpoint to resend after expiry. " +
      `Requests within ${OTP_RESEND_COOLDOWN_SECONDS} seconds of the previous code are rejected with 429; the UI should show a matching cooldown. Issuing a code invalidates earlier ones. ` +
      "No request body. Returns `{ status: 200, message: \"OTP sent successfully\" }`. " +
      "Requires a valid Bearer JWT for role `user` or `vendor`.",
  })
  @ApiResponseDoc({
    status: 200,
    description: "A new code has been emailed to the account address",
  })
  @ApiResponseDoc({
    status: 404,
    description: "Account id in the JWT was not found",
  })
  @ApiResponseDoc({
    status: 429,
    description: `A code was requested less than ${OTP_RESEND_COOLDOWN_SECONDS} seconds ago`,
  })
  async resendOtp(@Req() req): Promise<ApiResponse> {
    await this.otpService.generateOtpForAccount(req.user._id, req.user.role);

    return {
      status: HttpStatus.OK,
      message: "OTP sent successfully",
    };
  }
}
