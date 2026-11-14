import { Controller, Param, Post, Res } from "@nestjs/common";
import { ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ApiPublicEndpoint } from "src/common/decorators/api-audience.decorator";
import { BaseController } from "src/modules/shared/base/controller.base";
import { Response } from "express";
import { OrdersService } from "../services/orders.service";

@ApiTags("Orders & Checkout")
@Controller("orders/public")
export class OrdersPublicController extends BaseController {
  constructor(private readonly ordersService: OrdersService) {
    super();
  }

  @Post(":id/verify-payment")
  @ApiPublicEndpoint({
    summary: "Verify Kashia payment after redirect (no auth)",
    description:
      "Called from the public payment return page after Kashia checkout. " +
      "Confirms the order with Kashia if paid. Returns only order id, reference, and payment status.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiResponse({ status: 200, description: "Verification result" })
  @ApiResponse({ status: 404, description: "Order not found" })
  async verifyPaymentReturn(
    @Param("id") orderId: string,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.verifyOrderPaymentPublic(orderId);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }
}
