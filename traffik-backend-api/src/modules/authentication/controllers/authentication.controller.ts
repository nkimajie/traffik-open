import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  UsePipes,
  HttpStatus,
} from "@nestjs/common";
import { AuthenticationService } from "../services/authentication.service";
import { AuthGuard } from "@nestjs/passport";
import { SignupValidation } from "../validations/signup.validation";
import {
  AdminLoginValidation,
  LoginValidation,
} from "../validations/login.validation";
import {
  ApiTags,
  ApiBody,
  ApiResponse as ApiResponseDoc,
} from "@nestjs/swagger";
import { SignupDto } from "../dto/signup.dto";
import { LoginDto } from "../dto/login.dto";
import { CreateAdminDto } from "../../admin/dto/create-admin.dto";
import { ApiResponse } from "../../../common/interfaces/response.interface";
import { JoiValidationPipe } from "src/common/pipes/validation/joi_validate.pipe";
import { CreateAdminValidation } from "../../admin/validations/create-admin.validation";
import {
  ApiPublicEndpoint,
  ApiAudience,
  ApiEndpoint,
} from "src/common/decorators/api-audience.decorator";

@ApiTags("Authentication")
@Controller("auth")
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @Post("signup")
  @UsePipes(new JoiValidationPipe(SignupValidation))
  @ApiPublicEndpoint({
    summary: "Register a shopper or vendor account",
    description:
      "Creates an account and returns an access token. The `role` field selects the account type: `user` creates a shopper, `vendor` creates a store owner who must then finish onboarding via `PATCH /vendors/complete-signup`. Admins are not created here — use `POST /auth/admin/create`.",
  })
  @ApiBody({ type: SignupDto })
  @ApiResponseDoc({
    status: 201,
    description:
      "Account created; response contains the access token and profile",
  })
  @ApiResponseDoc({ status: 400, description: "Validation failed" })
  @ApiResponseDoc({
    status: 409,
    description: "Email or phone already registered",
  })
  async signup(@Body() signupDto: SignupDto): Promise<ApiResponse> {
    const data = await this.authService.signup(signupDto);
    return {
      status: HttpStatus.CREATED,
      message: "User registered successfully",
      data,
    };
  }

  @Post("login")
  @UsePipes(new JoiValidationPipe(LoginValidation))
  @ApiPublicEndpoint({
    summary: "Log in as a shopper or vendor",
    description:
      "Exchanges email and password for an access token. Send `role: user` from the shopper apps and `role: vendor` from the vendor portal — the role decides which account collection is searched. Admins must use `POST /auth/admin/login`.",
  })
  @ApiBody({ type: LoginDto })
  @ApiResponseDoc({
    status: 200,
    description:
      "Login successful; response contains the access token and profile",
  })
  @ApiResponseDoc({ status: 401, description: "Invalid credentials" })
  async login(@Body() loginDto: LoginDto): Promise<ApiResponse> {
    const data = await this.authService.login(loginDto);
    return {
      status: HttpStatus.OK,
      message: "Login successful",
      data,
    };
  }

  @Post("admin/login")
  @UsePipes(new JoiValidationPipe(AdminLoginValidation))
  @ApiPublicEndpoint({
    summary: "Log in as a platform admin",
    description:
      "Separate login for the admin console. Returns a token carrying role `admin`, which unlocks every `Callable by: Admin` endpoint.",
  })
  @ApiBody({ type: LoginDto })
  @ApiResponseDoc({
    status: 200,
    description: "Admin login successful; response contains the access token",
  })
  @ApiResponseDoc({ status: 401, description: "Invalid credentials" })
  async adminLogin(@Body() loginDto: LoginDto): Promise<ApiResponse> {
    const data = await this.authService.adminLogin(loginDto);
    return {
      status: HttpStatus.OK,
      message: "Admin login successful",
      data,
    };
  }

  @Post("admin/create")
  @UsePipes(new JoiValidationPipe(CreateAdminValidation))
  @ApiPublicEndpoint({
    summary: "Bootstrap the first platform admin",
    description:
      "One-time provisioning endpoint for the initial admin account. It is open so the platform can be bootstrapped on a fresh database; it must be disabled or protected before production traffic.",
  })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponseDoc({ status: 201, description: "Admin created" })
  @ApiResponseDoc({
    status: 409,
    description: "An admin with that email already exists",
  })
  async createAdmin(
    @Body() createAdminDto: CreateAdminDto,
  ): Promise<ApiResponse> {
    const data = await this.authService.createAdmin(createAdminDto);
    return {
      status: HttpStatus.CREATED,
      message: "Admin created successfully",
      data,
    };
  }

  @Post("google")
  @UseGuards(AuthGuard("google"))
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER, ApiAudience.VENDOR],
    summary: "Log in with Google",
    optionalAuth: true,
    description:
      "Completes a Google OAuth handshake and returns a Traffik access token. Called by the shopper apps and the vendor portal; the account is created on first sign-in.",
  })
  @ApiResponseDoc({
    status: 200,
    description: "Google authentication successful",
  })
  @ApiResponseDoc({ status: 401, description: "Google credential rejected" })
  async googleAuth(@Req() req): Promise<ApiResponse> {
    const data = await this.authService.googleLogin(req.user);
    return {
      status: HttpStatus.OK,
      message: "Google authentication successful",
      data,
    };
  }

  @Post("apple")
  @UseGuards(AuthGuard("apple"))
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER, ApiAudience.VENDOR],
    summary: "Log in with Apple",
    optionalAuth: true,
    description:
      "Completes an Apple OAuth handshake and returns a Traffik access token. Called by the shopper apps and the vendor portal; the account is created on first sign-in.",
  })
  @ApiResponseDoc({
    status: 200,
    description: "Apple authentication successful",
  })
  @ApiResponseDoc({ status: 401, description: "Apple credential rejected" })
  async appleAuth(@Req() req): Promise<ApiResponse> {
    const data = await this.authService.appleLogin(req.user);
    return {
      status: HttpStatus.OK,
      message: "Apple authentication successful",
      data,
    };
  }
}
