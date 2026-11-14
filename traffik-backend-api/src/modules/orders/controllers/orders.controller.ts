import {
  Controller,
  Post,
  Get,
  Body,
  Patch,
  Param,
  Res,
  UseGuards,
  HttpCode,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from "@nestjs/swagger";
import {
  ApiAdminEndpoint,
  ApiShopperEndpoint,
} from "src/common/decorators/api-audience.decorator";
import { OrdersService } from "../services/orders.service";
import { OrderStatus } from "../enums/order.enum";
import { CheckoutPreviewDto, CreateOrderDto } from "../dto/checkout.dto";
import { UpdateOrderStatusDto } from "../dto/update-status.dto";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import RoleGuard from "src/common/guards/roles.guard";
import { UserRole } from "src/modules/users/enums/user-role.enum";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { JoiValidationPipe } from "src/common/pipes/validation/joi_validate.pipe";
import { BaseController } from "src/modules/shared/base/controller.base";
import { Response } from "express";
import { CheckoutValidation } from "../validations/order.validation";
import { UpdateOrderStatusValidation } from "../validations/update-status.validation";
import {
  CompleteOrderRefundDto,
  ReopenOrderRefundDto,
  ResolvePaymentAlertDto,
} from "../dto/complete-refund.dto";
import {
  CompleteOrderRefundValidation,
  ReopenOrderRefundValidation,
  ResolvePaymentAlertValidation,
} from "../validations/complete-refund.validation";
import { OrderRefundStatus } from "../enums/order-refund.enum";
import { MongoIdPipe } from "src/modules/shared/pipes/mongo-id.pipe";
@ApiTags("Orders & Checkout")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController extends BaseController {
  constructor(private readonly ordersService: OrdersService) {
    super();
  }

  @Post("preview")
  @HttpCode(200)
  @ApiShopperEndpoint({
    summary: "Preview the checkout totals",
    description:
      "Prices the authenticated shopper's cart against a chosen delivery address and method without placing an order. Returns line items, delivery fee, voucher discount, and the grand total so the checkout screen can show a final figure before payment.",
  })
  @ApiResponse({ status: 200, description: "Order preview generated" })
  @ApiResponse({
    status: 400,
    description: "Cart is empty, or the address or delivery method is invalid",
  })
  async previewOrder(
    @GetUser("_id") userId: string,
    @Body(new JoiValidationPipe(CheckoutValidation))
    previewDto: CheckoutPreviewDto,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.previewOrder(userId, previewDto);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post()
  @ApiShopperEndpoint({
    summary: "Place an order",
    description:
      "Converts the authenticated shopper's cart into an order and empties the cart. Call `POST /orders/preview` first to confirm the totals the shopper is agreeing to.",
  })
  @ApiResponse({ status: 201, description: "Order created successfully" })
  @ApiResponse({
    status: 400,
    description: "Cart is empty, stock ran out, or the payload is invalid",
  })
  async createOrder(
    @GetUser("_id") userId: string,
    @Body(new JoiValidationPipe(CheckoutValidation))
    createDto: CreateOrderDto,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.createOrder(userId, createDto);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data, 201);
  }

  @Get()
  @ApiShopperEndpoint({
    summary: "List order history",
    description:
      "Returns the authenticated shopper's orders newest first, one entry per order. For the mobile 'My Orders' screen, which shows one card per purchased item, use `GET /orders/my-orders` instead.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (starts from 1)",
    example: 1,
  })
  @ApiQuery({
    name: "itemsPerPage",
    required: false,
    type: Number,
    description: "Number of items per page",
    example: 10,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Alias for itemsPerPage (number of items per page)",
    example: 10,
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
    description: "Filter by order status (omit for all statuses)",
  })
  @ApiResponse({
    status: 200,
    description: "Returns paginated list of user orders (items + meta)",
  })
  async getUserOrders(
    @GetUser("_id") userId: string,
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("itemsPerPage") itemsPerPageQuery?: string | number,
    @Query("status") statusQuery?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(
      1,
      parseInt(String(limitQuery ?? itemsPerPageQuery ?? 10), 10) || 10,
    );

    let status: OrderStatus | undefined;
    if (statusQuery != null && String(statusQuery).trim() !== "") {
      const normalized = String(statusQuery).trim().toUpperCase();
      if (!Object.values(OrderStatus).includes(normalized as OrderStatus)) {
        return this.throwErrorRaw("Invalid order status", 400);
      }
      status = normalized as OrderStatus;
    }

    const result = await this.ordersService.getUserOrders(userId, {
      page,
      limit,
      status,
    });
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("pending-reviews")
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "List purchased items awaiting a review",
    description:
      "Returns order lines the shopper has not reviewed yet (`review` is always null). Post the review with `POST /products/{productId}/reviews`, using the `productId` and `orderId` from each entry; including `orderId` in the body marks the review as verified once the order is `DELIVERED`.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: "itemsPerPage",
    required: false,
    type: Number,
    description: "Legacy alias for limit",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: [
      // "PENDING",
      // "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ],
    description:
      "Single order status to narrow results (omit for PROCESSING + DELIVERED + CANCELLED)",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated pending review line items",
  })
  async getPendingReviews(
    @GetUser("_id") userId: string,
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("itemsPerPage") itemsPerPageQuery?: string | number,
    @Query("status") statusQuery?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(
      1,
      parseInt(String(limitQuery ?? itemsPerPageQuery ?? 10), 10) || 10,
    );

    let status: OrderStatus | undefined;
    if (statusQuery != null && String(statusQuery).trim() !== "") {
      const normalized = String(statusQuery).trim().toUpperCase();
      if (!Object.values(OrderStatus).includes(normalized as OrderStatus)) {
        return this.throwErrorRaw("Invalid order status", 400);
      }
      status = normalized as OrderStatus;
    }

    const result = await this.ordersService.getPendingReviewLineItems(userId, {
      page,
      limit,
      status,
    });
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("my-orders")
  @ApiShopperEndpoint({
    summary: "List purchased items for the My Orders screen",
    description:
      "Returns the authenticated shopper's orders flattened to one entry per purchased item, which is what the mobile and web 'My Orders' screens render. Filter with `status=OPEN` (pending, processing, shipped) or `status=CLOSED` (delivered, cancelled).",
  })
  @ApiQuery({
    name: "status",
    enum: ["OPEN", "CLOSED"],
    required: false,
    description:
      "OPEN: pending/processing/shipped, CLOSED: delivered/cancelled",
  })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: "Paginated purchased items (items + meta)",
  })
  async getMyOrders(
    @GetUser("_id") userId: string,
    @Res() res: Response,
    @Query("status") status?: "OPEN" | "CLOSED",
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 10), 10) || 10);

    const result = await this.ordersService.getMyOrders(userId, {
      page,
      limit,
      status,
    });

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("admin")
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "List all platform orders",
    description:
      "Paginated orders across every vendor store for the admin **Orders** console. " +
      "Supports filtering by fulfilment status. Update any order with `PATCH /orders/{id}/status`. " +
      "Response shape: `{ status, message, data: { items, meta } }` where `meta` carries `total`, `page`, `limit`, and `totalPages`.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (starts from 1)",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of items per page",
    example: 10,
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
    description: "Filter by order status (omit for all statuses)",
  })
  @ApiQuery({
    name: "refundStatus",
    required: false,
    enum: Object.values(OrderRefundStatus),
    description:
      "Only orders with a refund in this state. `REQUIRED` is the queue of refunds still to be made.",
  })
  @ApiQuery({
    name: "alerts",
    required: false,
    enum: ["OPEN"],
    description:
      "`OPEN`: only orders with a payment alert (dispute, money released for a cancelled order, payment returned after shipping, ...) not yet resolved.",
  })
  @ApiResponse({
    status: 200,
    description: "Returns paginated list of platform orders (items + meta)",
  })
  async getAdminOrders(
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("status") statusQuery?: string,
    @Query("refundStatus") refundStatusQuery?: string,
    @Query("alerts") alertsQuery?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(
      1,
      parseInt(String(limitQuery ?? 10), 10) || 10,
    );

    let status: OrderStatus | undefined;
    if (statusQuery != null && String(statusQuery).trim() !== "") {
      const normalized = String(statusQuery).trim().toUpperCase();
      if (!Object.values(OrderStatus).includes(normalized as OrderStatus)) {
        return this.throwErrorRaw("Invalid order status", 400);
      }
      status = normalized as OrderStatus;
    }

    let refundStatus: OrderRefundStatus | undefined;
    if (refundStatusQuery != null && String(refundStatusQuery).trim() !== "") {
      const normalized = String(refundStatusQuery).trim().toUpperCase();
      if (
        !Object.values(OrderRefundStatus).includes(
          normalized as OrderRefundStatus,
        )
      ) {
        return this.throwErrorRaw("Invalid refund status", 400);
      }
      refundStatus = normalized as OrderRefundStatus;
    }

    let openAlertsOnly = false;
    if (alertsQuery != null && String(alertsQuery).trim() !== "") {
      if (String(alertsQuery).trim().toUpperCase() !== "OPEN") {
        return this.throwErrorRaw("Invalid alerts filter", 400);
      }
      openAlertsOnly = true;
    }

    const result = await this.ordersService.getAdminOrders({
      page,
      limit,
      status,
      refundStatus,
      openAlertsOnly,
    });
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get(":id")
  @ApiShopperEndpoint({
    summary: "Get one order",
    description:
      "Returns the full detail of a single order — line items, delivery address and method, payment reference, status timeline, and totals. Only orders belonging to the authenticated shopper are visible.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiResponse({ status: 200, description: "Order retrieved successfully" })
  @ApiResponse({
    status: 404,
    description: "Order not found or not owned by the caller",
  })
  async getOrderById(
    @GetUser("_id") userId: string,
    @Param("id") orderId: string,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.getOrderById(userId, orderId);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post(":id/cancel")
  @ApiShopperEndpoint({
    summary: "Cancel an order",
    description:
      "Cancels one of the authenticated shopper's own orders while it is still awaiting payment or vendor acceptance.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiResponse({ status: 200, description: "Order cancelled successfully" })
  @ApiResponse({
    status: 400,
    description: "Order has already shipped, been delivered, or been cancelled",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found or not owned by the caller",
  })
  async cancelOrder(
    @GetUser("_id") userId: string,
    @Param("id") orderId: string,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.cancelOrder(userId, orderId);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post(":id/payment-link")
  @ApiShopperEndpoint({
    summary: "Create a Kashia payment link for an unpaid order",
    description:
      "Generates a new Kashia checkout link for an order in PENDING_PAYMENT. " +
      "Use when the shopper returns to pay later or the previous link expired.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiResponse({ status: 200, description: "Payment link created" })
  @ApiResponse({ status: 400, description: "Order is not awaiting payment" })
  @ApiResponse({ status: 404, description: "Order not found" })
  async createPaymentLink(
    @GetUser("_id") userId: string,
    @Param("id") orderId: string,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.createOrderPaymentLink(
      userId,
      orderId,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post(":id/verify-payment")
  @ApiShopperEndpoint({
    summary: "Verify Kashia payment after redirect",
    description:
      "Called when the shopper returns from Kashia checkout. Looks up the payment link on Kashia and confirms the order if payment succeeded. " +
      "Idempotent — does nothing harmful if the escrow.active webhook already confirmed the order.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiResponse({ status: 200, description: "Verification result with order" })
  @ApiResponse({ status: 404, description: "Order not found" })
  async verifyPayment(
    @GetUser("_id") userId: string,
    @Param("id") orderId: string,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.verifyOrderPayment(userId, orderId);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post(":id/confirm-delivery")
  @ApiShopperEndpoint({
    summary: "Confirm order delivery",
    description:
      "Shopper confirms receipt after the store has marked the order as shipped.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiResponse({ status: 200, description: "Delivery confirmed" })
  async confirmDelivery(
    @GetUser("_id") userId: string,
    @Param("id") orderId: string,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.confirmOrderDelivery(
      userId,
      orderId,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Patch(":id/status")
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "Move an order to a new status",
    description:
      "Advances any order through the fulfilment states (`PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`) and appends an entry to the order's status timeline. This is the admin console's fulfilment control; shoppers can only cancel their own orders.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiResponse({
    status: 200,
    description: "Order status updated successfully",
  })
  @ApiResponse({ status: 400, description: "Status transition is not allowed" })
  @ApiResponse({ status: 404, description: "Order not found" })
  async updateOrderStatus(
    @Param("id") orderId: string,
    @Body(new JoiValidationPipe(UpdateOrderStatusValidation))
    updateDto: UpdateOrderStatusDto,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.updateOrderStatus(
      orderId,
      updateDto.status,
      updateDto.description,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post(":id/refunds/:refundId/complete")
  @HttpCode(200)
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "Record a refund made by hand",
    description:
      "Closes a refund owed to the shopper once the money has been returned outside Kashia's refund flow (most refunds). " +
      "Requires the payout method and reference, and the amount typed again (it must equal the refund amount). A payout reference can back only one refund. " +
      "The shopper is emailed the reference and can report the money missing for 30 days, which reopens the refund. " +
      "Refunds Kashia reports through `escrow.refunded` are closed automatically. Find outstanding refunds with `GET /orders/admin?refundStatus=REQUIRED`.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiParam({
    name: "refundId",
    description: "Refund ObjectId (from `order.refunds`)",
  })
  @ApiResponse({ status: 200, description: "Refund marked as completed" })
  @ApiResponse({
    status: 400,
    description: "Missing evidence, or the amount does not match the refund",
  })
  @ApiResponse({ status: 404, description: "Order or refund not found" })
  @ApiResponse({
    status: 409,
    description:
      "Refund already completed, or the payout reference is already used for another refund",
  })
  async completeRefund(
    @GetUser("_id") adminId: string,
    @Param("id", MongoIdPipe) orderId: string,
    @Param("refundId", MongoIdPipe) refundId: string,
    @Body(new JoiValidationPipe(CompleteOrderRefundValidation))
    body: CompleteOrderRefundDto,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.completeOrderRefund(
      orderId,
      refundId,
      adminId,
      body,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post(":id/refunds/:refundId/reopen")
  @HttpCode(200)
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "Reopen a refund completed by hand",
    description:
      "Puts a refund an admin completed back in the refund queue, e.g. it was marked by mistake. The completion and the reason stay in the refund's history. Refunds Kashia confirmed cannot be reopened.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiParam({ name: "refundId", description: "Refund ObjectId" })
  @ApiResponse({ status: 200, description: "Refund reopened" })
  @ApiResponse({ status: 404, description: "Order or refund not found" })
  @ApiResponse({
    status: 409,
    description: "Refund is still open, or was confirmed by Kashia",
  })
  async reopenRefund(
    @GetUser("_id") adminId: string,
    @Param("id", MongoIdPipe) orderId: string,
    @Param("refundId", MongoIdPipe) refundId: string,
    @Body(new JoiValidationPipe(ReopenOrderRefundValidation))
    body: ReopenOrderRefundDto,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.reopenOrderRefund(
      orderId,
      refundId,
      adminId,
      body.reason,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post(":id/refunds/:refundId/not-received")
  @HttpCode(200)
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "Report a refund as not received",
    description:
      "For a refund marked as sent by hand in the last 30 days. Puts it back in the admin refund queue so the payout is checked; it does not send money by itself.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiParam({ name: "refundId", description: "Refund ObjectId" })
  @ApiResponse({ status: 200, description: "Refund reopened" })
  @ApiResponse({ status: 404, description: "Order or refund not found" })
  @ApiResponse({
    status: 409,
    description:
      "Refund still in progress, confirmed by Kashia, or past the reporting window",
  })
  async reportRefundNotReceived(
    @GetUser("_id") userId: string,
    @Param("id", MongoIdPipe) orderId: string,
    @Param("refundId", MongoIdPipe) refundId: string,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.reportRefundNotReceived(
      userId,
      orderId,
      refundId,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(
      res,
      "Thanks for letting us know. We'll check the refund and get back to you.",
      result.data,
    );
  }

  @Post(":id/alerts/:alertId/resolve")
  @HttpCode(200)
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "Resolve a payment alert",
    description:
      "Records how a payment alert was dealt with (e.g. money recovered from the store, dispute settled). Alerts are raised when Kashia's escrow and the order disagree. Find open alerts with `GET /orders/admin?alerts=OPEN`.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiParam({
    name: "alertId",
    description: "Alert ObjectId (from `order.paymentAlerts`)",
  })
  @ApiResponse({ status: 200, description: "Alert resolved" })
  @ApiResponse({ status: 404, description: "Order or alert not found" })
  @ApiResponse({ status: 409, description: "Alert already resolved" })
  async resolvePaymentAlert(
    @GetUser("_id") adminId: string,
    @Param("id", MongoIdPipe) orderId: string,
    @Param("alertId", MongoIdPipe) alertId: string,
    @Body(new JoiValidationPipe(ResolvePaymentAlertValidation))
    body: ResolvePaymentAlertDto,
    @Res() res: Response,
  ) {
    const result = await this.ordersService.resolvePaymentAlert(
      orderId,
      alertId,
      adminId,
      body.note,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }
}
