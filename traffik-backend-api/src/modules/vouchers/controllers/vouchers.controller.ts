import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  ApiAdminEndpoint,
  ApiAudience,
  ApiEndpoint,
} from "src/common/decorators/api-audience.decorator";
import { VouchersService } from "../services/vouchers.service";
import { CreateVoucherDto } from "../dto/create-voucher.dto";
import { CreateVoucherValidation } from "../validations/create-voucher.validation";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import RoleGuard from "src/common/guards/roles.guard";
import { UserRole } from "src/modules/users/enums/user-role.enum";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { JoiValidationPipe } from "src/common/pipes/validation/joi_validate.pipe";
import { BaseController } from "src/modules/shared/base/controller.base";
import { Response } from "express";

@ApiTags("Vouchers")
@Controller("vouchers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class VouchersController extends BaseController {
  constructor(private readonly vouchersService: VouchersService) {
    super();
  }

  @Post()
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "Create a discount voucher",
    description:
      "Creates a platform-wide discount code with its value, validity window, and usage limits. Shoppers discover codes through `GET /vouchers` and redeem them with `POST /carts/voucher`.",
  })
  @ApiResponse({
    status: 201,
    description: "The voucher has been successfully created",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 409, description: "Voucher code already exists" })
  async create(
    @GetUser("_id") adminId: string,
    @Body(new JoiValidationPipe(CreateVoucherValidation))
    createVoucherDto: CreateVoucherDto,
    @Res() res: Response,
  ) {
    const result = await this.vouchersService.create(createVoucherDto, adminId);

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get()
  @ApiEndpoint({
    audience: [ApiAudience.SHOPPER, ApiAudience.VENDOR, ApiAudience.ADMIN],
    summary: "List active vouchers",
    description:
      "Returns every voucher that is currently within its validity window. Any signed-in caller may read this list; the shopper apps use it to show available codes at checkout.",
  })
  @ApiResponse({
    status: 200,
    description: "Returns list of active vouchers",
  })
  async findAll(@Res() res: Response) {
    const result = await this.vouchersService.findAll();

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }
}
