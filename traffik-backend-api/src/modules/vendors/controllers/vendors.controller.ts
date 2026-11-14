import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  ApiAdminEndpoint,
  ApiAudience,
  ApiEndpoint,
  ApiShopperEndpoint,
  ApiVendorEndpoint,
} from "src/common/decorators/api-audience.decorator";
import { VendorsService } from "../services/vendors.service";
import { CompleteVendorSignupDto } from "../dto/complete-vendor-signup.dto";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import RoleGuard from "../../../common/guards/roles.guard";
import { UserRole } from "../../users/enums/user-role.enum";
import { GetUser } from "../../../common/decorators/get-user.decorator";
import { IVendor } from "../interfaces/vendors.interface";
import { CompleteVendorSignupValidation } from "../validations/complete-vendor-signup.validation";
import { JoiValidationPipe } from "src/common/pipes/validation/joi_validate.pipe";
import { MongoIdPipe } from "src/modules/shared/pipes/mongo-id.pipe";
import { BaseController } from "src/modules/shared/base/controller.base";
import {
  ProductSortOption,
  ProductStatusFilter,
} from "../dto/vendor-products.dto";
import { Response } from "express";
import { OptionalJwtAuthGuard } from "src/common/guards/optional-jwt-auth.guard";
import {
  SubmitVendorKycDto,
  UpdateKycStatusDto,
} from "../dto/submit-vendor-kyc.dto";
import {
  SubmitVendorKycValidation,
  UpdateKycStatusValidation,
} from "../validations/vendor-kyc.validation";
import { AdminStoresResponseDto } from "../dto/admin-stores.dto";
import { UpdateVendorApprovalDto } from "../dto/update-vendor-approval.dto";
import { OrderStatus } from "../../orders/enums/order.enum";
import { UpdateOrderStatusDto } from "../../orders/dto/update-status.dto";
import { UpdateOrderStatusValidation } from "../../orders/validations/update-status.validation";

/**
 * Authenticated `/vendors` routes. Every method requires a token (class-level
 * `JwtAuthGuard`) and then narrows to a role: store management for vendors,
 * favourites and likes for shoppers, KYC review and store oversight for admins.
 * Anonymous storefront reads live in `PublicVendorsController` below.
 */
@ApiTags("Vendors")
@Controller("vendors")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class VendorsController extends BaseController {
  constructor(private readonly vendorsService: VendorsService) {
    super();
  }

  @Get("me")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "Get my vendor profile",
    description:
      "Returns the authenticated vendor's store profile, including onboarding completion status. Used by the create-business flow to prefill saved details.",
  })
  @ApiResponse({ status: 200, description: "Vendor profile retrieved" })
  async getMyProfile(@GetUser("_id") vendorId: string) {
    const vendor = await this.vendorsService.findById(vendorId);
    if (!vendor) {
      return this.throwErrorRaw("Vendor not found", 404);
    }
    return this.vendorsService.formatVendorData(vendor);
  }

  @Patch("complete-signup")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "Complete store onboarding",
    description:
      "Second step of vendor signup: attaches the store profile (name, description, logo, address, business details) to the account created by `POST /auth/signup`. Submit KYC next with `POST /vendors/kyc`.",
  })
  @ApiResponse({
    status: 200,
    description: "Vendor signup completed successfully",
  })
  @ApiResponse({ status: 400, description: "Validation failed" })
  @ApiResponse({ status: 404, description: "Vendor not found" })
  async completeSignup(
    @GetUser() vendor: IVendor,
    @Body(new JoiValidationPipe(CompleteVendorSignupValidation))
    completeSignupDto: CompleteVendorSignupDto,
  ) {
    const updatedVendor = await this.vendorsService.completeSignup(
      vendor._id,
      completeSignupDto,
    );
    return this.vendorsService.formatVendorData(updatedVendor);
  }

  @Patch("save-store-as-favorite/:vendorId")
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "Save a store to favourites",
    description:
      "Adds a store to the authenticated shopper's saved stores. Read the list back with `GET /vendors/saved-stores`. Saving is separate from liking (`PATCH /vendors/toggle-vendor-like/{vendorId}`), which drives the trending ranking.",
  })
  @ApiParam({
    name: "vendorId",
    description: "Vendor (store) ObjectId",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Store saved as favorite successfully",
  })
  @ApiResponse({ status: 404, description: "Store not found or not active" })
  async saveStoreAsFavorite(
    @Param("vendorId", MongoIdPipe) vendorId: string,
    @GetUser("_id") userId: string,
    @Res() res: Response,
  ) {
    const result = await this.vendorsService.saveStoreAsFavorite(
      userId,
      vendorId,
    );

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Patch("remove-store-as-favorite/:vendorId")
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "Remove a store from favourites",
    description:
      "Takes a store out of the authenticated shopper's saved stores.",
  })
  @ApiParam({
    name: "vendorId",
    description: "Vendor (store) ObjectId",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Store removed from favorites successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Store is not in your favorites or already removed",
  })
  async removeStoreAsFavorite(
    @Param("vendorId", MongoIdPipe) vendorId: string,
    @GetUser("_id") userId: string,
    @Res() res: Response,
  ) {
    const result = await this.vendorsService.removeStoreAsFavorite(
      userId,
      vendorId,
    );

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Patch("toggle-vendor-like/:vendorId")
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "Like or unlike a store",
    description:
      "Toggles the authenticated shopper's like on a store and returns the new `isLiked` state with the store's `totalLikes`. Likes drive `GET /vendors/trending`.",
  })
  @ApiParam({
    name: "vendorId",
    description: "Vendor (store) ObjectId",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Returns isLiked and totalLikes for the store",
  })
  @ApiResponse({ status: 404, description: "Store not found or not active" })
  async toggleVendorLike(
    @Param("vendorId", MongoIdPipe) vendorId: string,
    @GetUser("_id") userId: string,
    @Res() res: Response,
  ) {
    const result = await this.vendorsService.toggleVendorLike(userId, vendorId);

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get("saved-stores")
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "List my saved stores",
    description:
      "Paginated stores the authenticated shopper has favourited. Backs the Stores tab of the Saved items screen.",
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
    description: "Items per page (alias for itemsPerPage)",
    example: 10,
  })
  @ApiQuery({
    name: "itemsPerPage",
    required: false,
    type: Number,
    description: "Number of items per page; ignored when limit is sent",
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description:
      "Paginated saved stores: items + meta (total, page, limit, totalPages)",
  })
  async getUserSavedStores(
    @GetUser("_id") userId: string,
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("itemsPerPage") itemsPerPageQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const itemsPerPage = Math.max(
      1,
      parseInt(String(limitQuery ?? itemsPerPageQuery ?? 10), 10) || 10,
    );
    const result = await this.vendorsService.getUserSavedStores(userId, {
      page,
      itemsPerPage,
    });

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get("liked")
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "List stores I have liked",
    description:
      "Paginated stores the authenticated shopper has liked. Liking is distinct from saving — see `GET /vendors/saved-stores` for favourites.",
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
    description: "Items per page (alias for itemsPerPage)",
    example: 10,
  })
  @ApiQuery({
    name: "itemsPerPage",
    required: false,
    type: Number,
    description: "Number of items per page; ignored when limit is sent",
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description:
      "Paginated liked vendors: items + meta (total, page, limit, totalPages)",
  })
  async getLikedVendors(
    @GetUser("_id") userId: string,
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("itemsPerPage") itemsPerPageQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const itemsPerPage = Math.max(
      1,
      parseInt(String(limitQuery ?? itemsPerPageQuery ?? 10), 10) || 10,
    );
    const result = await this.vendorsService.getLikedVendors(userId, {
      page,
      itemsPerPage,
    });

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get("trending")
  @UseGuards(RoleGuard([UserRole.USER, UserRole.ADMIN]))
  @ApiEndpoint({
    audience: [ApiAudience.SHOPPER, ApiAudience.ADMIN],
    summary: "List trending stores",
    description:
      "Up to ten active stores that have at least one like, ranked by `totalLikes` descending. Shoppers additionally receive `isLiked` per store. Admins call it to see which stores are gaining traction.",
  })
  @ApiResponse({
    status: 200,
    description:
      "items: vendor payloads with totalLikes and isLiked for buyers",
  })
  async getTrendingVendors(
    @Res() res: Response,
    @GetUser() user: { _id: string; role: string },
  ) {
    const result = await this.vendorsService.findTrendingVendors(
      user._id,
      user.role,
    );

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get()
  @ApiEndpoint({
    audience: [ApiAudience.SHOPPER, ApiAudience.VENDOR, ApiAudience.ADMIN],
    summary: "List all stores in random order",
    description:
      "Paginated active stores, shuffled so discovery is not biased toward the oldest stores. Any signed-in caller may read it; shoppers also receive `isLiked` and favourite flags. For an anonymous storefront listing there is no open equivalent yet — fetch individual stores with `GET /vendors/public/{vendorId}`.",
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
    description: "Items per page (alias for itemsPerPage)",
    example: 10,
  })
  @ApiQuery({
    name: "itemsPerPage",
    required: false,
    type: Number,
    description: "Number of items per page; ignored when limit is sent",
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description:
      "Paginated vendors: items + meta (total, page, limit, totalPages)",
  })
  async getAllVendors(
    @Res() res: Response,
    @GetUser() user: { _id: string; role: string },
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("itemsPerPage") itemsPerPageQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const itemsPerPage = Math.max(
      1,
      parseInt(String(limitQuery ?? itemsPerPageQuery ?? 10), 10) || 10,
    );
    const result = await this.vendorsService.getAllVendorsRandom(
      { page, itemsPerPage },
      user._id,
      user.role,
    );

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Post("kyc")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "Submit KYC documents",
    description:
      "Submits identity and business verification details for the authenticated vendor. Upload the document images first with `POST /files/upload` and send the returned URLs. An admin then approves or rejects the submission via `PATCH /vendors/kyc/admin/{kycId}/status`.",
  })
  @ApiResponse({ status: 201, description: "KYC submitted successfully" })
  @ApiResponse({
    status: 400,
    description: "Validation failed, or a submission is already under review",
  })
  async submitKyc(
    @GetUser("_id") vendorId: string,
    @Body(new JoiValidationPipe(SubmitVendorKycValidation))
    dto: SubmitVendorKycDto,
    @Res() res: Response,
  ) {
    const result = await this.vendorsService.submitKyc(vendorId, dto);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("kyc/admin")
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "List vendor KYC submissions",
    description:
      "Paginated KYC submissions across all vendors, for the admin verification queue. Act on one with `PATCH /vendors/kyc/admin/{kycId}/status`.",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "KYCs retrieved successfully" })
  async getAllKycs(
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 10), 10) || 10);

    const result = await this.vendorsService.getAllKycs({
      page,
      itemsPerPage: limit,
    });
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Patch("kyc/admin/:kycId/status")
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "Approve or reject a KYC submission",
    description:
      "Sets the decision on one vendor's KYC submission. Approval is what allows the store to trade; a rejection should carry a reason so the vendor can correct and resubmit.",
  })
  @ApiParam({ name: "kycId", description: "KYC record ObjectId" })
  @ApiResponse({ status: 200, description: "KYC status updated successfully" })
  @ApiResponse({ status: 404, description: "KYC record not found" })
  async updateKycStatus(
    @Param("kycId", MongoIdPipe) kycId: string,
    @Body(new JoiValidationPipe(UpdateKycStatusValidation))
    dto: UpdateKycStatusDto,
    @Res() res: Response,
  ) {
    const result = await this.vendorsService.updateKycStatus(kycId, dto);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("dashboard")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "Get my store dashboard",
    description:
      "Headline metrics for the authenticated vendor's store — revenue, order counts, product counts — plus a paginated list of recent customers. This is the vendor portal landing page.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Recent customers page",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Recent customers per page",
  })
  @ApiResponse({ status: 200, description: "Dashboard data retrieved" })
  async getDashboard(
    @GetUser("_id") vendorId: string,
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 5), 10) || 5);

    const result = await this.vendorsService.getVendorDashboard(vendorId, {
      page,
      itemsPerPage: limit,
    });

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get("my-products")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "List my products with stock filters",
    description:
      "Paginated products for the authenticated vendor's store, filterable by stock status and sortable. Compared with `GET /products/vendor/me`, this variant is shaped for the vendor portal's inventory table.",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ProductStatusFilter,
    description: "Filter by stock status",
  })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: ProductSortOption,
    description: "Sort products",
  })
  @ApiResponse({ status: 200, description: "Products retrieved successfully" })
  async getMyProducts(
    @GetUser("_id") vendorId: string,
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("status") status?: ProductStatusFilter,
    @Query("sort") sort?: ProductSortOption,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 10), 10) || 10);

    const result = await this.vendorsService.getVendorProducts(vendorId, {
      page,
      itemsPerPage: limit,
      status,
      sort,
    });

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get("orders")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "List my store orders",
    description:
      "Paginated orders that include at least one product from the authenticated vendor's store.",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, enum: OrderStatus })
  @ApiResponse({ status: 200, description: "Vendor orders" })
  async getVendorOrders(
    @GetUser("_id") vendorId: string,
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("status") status?: OrderStatus,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 10), 10) || 10);
    const result = await this.vendorsService.getVendorOrders(vendorId, {
      page,
      limit,
      status,
    });
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("orders/:id")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "Get a vendor order by ID",
    description:
      "Order detail scoped to the authenticated vendor's line items only.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiResponse({ status: 200, description: "Vendor order detail" })
  async getVendorOrderById(
    @GetUser("_id") vendorId: string,
    @Param("id", MongoIdPipe) id: string,
    @Res() res: Response,
  ) {
    const result = await this.vendorsService.getVendorOrderById(vendorId, id);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Patch("orders/:id/status")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "Update an order status",
    description:
      "Vendor accepts, rejects, or marks an order shipped. Only orders belonging to the authenticated vendor's store are visible.",
  })
  @ApiParam({ name: "id", description: "Order ObjectId" })
  @ApiResponse({ status: 200, description: "Order status updated" })
  async updateVendorOrderStatus(
    @GetUser("_id") vendorId: string,
    @Param("id", MongoIdPipe) id: string,
    @Body(new JoiValidationPipe(UpdateOrderStatusValidation))
    updateDto: UpdateOrderStatusDto,
    @Res() res: Response,
  ) {
    const result = await this.vendorsService.updateVendorOrderStatus(
      vendorId,
      id,
      updateDto.status,
      updateDto.description,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("transactions")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "List vendor transactions",
    description: "Delivered order line items for the authenticated vendor's products.",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Transactions" })
  async getVendorTransactions(
    @GetUser("_id") vendorId: string,
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 10), 10) || 10);
    const result = await this.vendorsService.getVendorTransactions(vendorId, {
      page,
      limit,
    });
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("my-customers")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "List my customers",
    description:
      "Distinct buyers who ordered from the authenticated vendor's store.",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Customers" })
  async getVendorCustomers(
    @GetUser("_id") vendorId: string,
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 10), 10) || 10);
    const result = await this.vendorsService.getVendorCustomers(vendorId, {
      page,
      limit,
    });
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("my-customers/:id")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "Get a customer profile",
    description: "Single customer summary for the authenticated vendor.",
  })
  @ApiParam({ name: "id", description: "Customer (user) ObjectId" })
  @ApiResponse({ status: 200, description: "Customer detail" })
  async getVendorCustomerById(
    @GetUser("_id") vendorId: string,
    @Param("id", MongoIdPipe) id: string,
    @Res() res: Response,
  ) {
    const result = await this.vendorsService.getVendorCustomerById(
      vendorId,
      id,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("my-products/:id/transactions")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "List transactions for a product",
    description: "Order line items for one of the vendor's products.",
  })
  @ApiParam({ name: "id", description: "Product ObjectId" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Product transactions" })
  async getProductTransactions(
    @GetUser("_id") vendorId: string,
    @Param("id", MongoIdPipe) productId: string,
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 10), 10) || 10);
    const result = await this.vendorsService.getProductTransactions(
      vendorId,
      productId,
      { page, limit },
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("my-products/:id/chart")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "Get product revenue chart",
    description: "Daily delivered revenue for a product over the last 30 days.",
  })
  @ApiParam({ name: "id", description: "Product ObjectId" })
  @ApiResponse({ status: 200, description: "Chart data" })
  async getProductChart(
    @GetUser("_id") vendorId: string,
    @Param("id", MongoIdPipe) productId: string,
    @Res() res: Response,
  ) {
    const result = await this.vendorsService.getProductChart(
      vendorId,
      productId,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("admin/all-stores")
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "List all stores for the admin console",
    description:
      "Paginated store directory for the admin **Stores** and **KYC queue** screens. " +
      "Returns owner contact fields, approval flags, and operational counts. " +
      "Unlike `GET /vendors`, this includes inactive and unapproved stores. " +
      "Filter with `approved=false` to list vendors awaiting Traffik agent review after onboarding. " +
      "Response shape: `{ status, message, data: { topStores, allStores, meta } }`.",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (starts at 1)",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Page size",
    example: 10,
  })
  @ApiQuery({
    name: "approved",
    required: false,
    type: Boolean,
    description:
      "When `true`, only approved stores. When `false`, only stores pending approval (`isApproved: false`). Omit for all stores.",
  })
  @ApiResponse({ status: 200, type: AdminStoresResponseDto })
  async getAdminStores(
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("approved") approvedQuery?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 10), 10) || 10);

    let approved: boolean | undefined;
    if (approvedQuery != null && String(approvedQuery).trim() !== "") {
      approved = String(approvedQuery).trim().toLowerCase() === "true";
    }

    const result = await this.vendorsService.getAdminStores(
      {
        page,
        itemsPerPage: limit,
      },
      approved !== undefined ? { approved } : undefined,
    );

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Patch("admin/:vendorId/approval")
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "Approve or reject a vendor store",
    description:
      "Sets the store's `isApproved` flag directly for vendors in the onboarding **Store verification** step, including those who have not submitted KYC bank details. " +
      "Use `approved` to unlock product listing and send the vendor approval email; use `rejected` with optional `notes` to decline. " +
      "This is the primary action on the admin **KYC queue** pending tab. " +
      "Response shape: `{ status, message, data: Vendor }`.",
  })
  @ApiParam({
    name: "vendorId",
    description: "MongoDB ObjectId of the vendor store record",
    example: "507f1f77bcf86cd799439011",
  })
  @ApiBody({ type: UpdateVendorApprovalDto })
  @ApiResponse({ status: 200, description: "Vendor approval status updated" })
  @ApiResponse({ status: 404, description: "Vendor not found" })
  async updateVendorApproval(
    @Param("vendorId", MongoIdPipe) vendorId: string,
    @Body(new JoiValidationPipe(UpdateKycStatusValidation))
    dto: UpdateVendorApprovalDto,
    @Res() res: Response,
  ) {
    const result = await this.vendorsService.updateVendorApproval(vendorId, dto);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }
}

/**
 * Unauthenticated routes under `/vendors`. Kept separate so the main controller can stay JWT-protected.
 */
@ApiTags("Vendors")
@Controller("vendors")
export class PublicVendorsController extends BaseController {
  constructor(private readonly vendorsService: VendorsService) {
    super();
  }

  @Get("public")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER],
    summary: "List public stores",
    description:
      "Paginated list of active, signup-completed stores for the storefront. Optional `q` filters by store name, description, or category.",
    optionalAuth: true,
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "q", required: false, type: String })
  @ApiResponse({ status: 200, description: "Paginated stores" })
  async listPublicVendors(
    @Res() res: Response,
    @GetUser() user?: { _id?: string; role?: string },
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("q") q?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 20), 10) || 20);

    if (q?.trim()) {
      const searchQuery = { $regex: q.trim(), $options: "i" };
      const result = await this.vendorsService.search(
        searchQuery,
        { page, limit },
        user?._id,
        user?.role,
      );
      return this.successResponse(res, "Stores retrieved successfully", {
        items: result.items,
        meta: result.meta,
      });
    }

    const result = await this.vendorsService.findAll(
      { page, limit, sort: { totalLikes: -1, createdAt: -1 } },
      user?._id,
      user?.role,
    );
    return this.successResponse(res, "Stores retrieved successfully", {
      items: result.items,
      meta: result.meta,
    });
  }

  @Get("public/trending")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER],
    summary: "List trending public stores",
    description:
      "Stores ranked by total likes for home-page rails. Works anonymously.",
    optionalAuth: true,
  })
  @ApiResponse({ status: 200, description: "Trending stores" })
  async listTrendingPublicVendors(
    @Res() res: Response,
    @GetUser() user?: { _id?: string; role?: string },
  ) {
    const result = await this.vendorsService.findTrendingVendors(
      user?._id,
      user?.role,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("public/:vendorId")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER],
    summary: "Get a public store page",
    description:
      "Everything the storefront store page needs in one call: the store profile (password omitted), `totalLikes`, `productCategories` derived from its active products, and a paginated page of active products. Filter the products with `categoryId`; the client can prepend its own 'All' tab. When a shopper token is sent, the response also carries `isLiked` for the store and favourite flags on each product.",
    optionalAuth: true,
  })
  @ApiParam({
    name: "vendorId",
    description: "Vendor (store) ObjectId",
    type: String,
  })
  @ApiQuery({
    name: "categoryId",
    required: false,
    type: String,
    description: "Mongo category id; omit for all products",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Products page (default 1)",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Products per page (default 10)",
    example: 10,
  })
  @ApiQuery({
    name: "itemsPerPage",
    required: false,
    type: Number,
    description: "Legacy alias for limit",
  })
  @ApiResponse({
    status: 200,
    description:
      "Vendor fields plus totalLikes, isLiked (buyers + JWT), productCategories, products",
  })
  @ApiResponse({
    status: 404,
    description: "Vendor not found or inactive",
  })
  async getPublicVendor(
    @Param("vendorId", MongoIdPipe) vendorId: string,
    @Res() res: Response,
    @GetUser() user?: { _id?: string; role?: string },
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("itemsPerPage") itemsPerPageQuery?: string | number,
    @Query("categoryId") categoryIdQuery?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(
      1,
      parseInt(String(limitQuery ?? itemsPerPageQuery ?? 10), 10) || 10,
    );
    const categoryId =
      categoryIdQuery && String(categoryIdQuery).trim()
        ? String(categoryIdQuery).trim()
        : undefined;

    const result = await this.vendorsService.getPublicVendorById(
      vendorId,
      { page, limit, categoryId },
      user?._id,
      user?.role,
    );

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }
}
