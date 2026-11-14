import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  HttpStatus,
  Query,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { UsersService } from "../services/users.service";
import { UpdateInterestsDto } from "../dto/update-interests.dto";
import { UpdateProfileDto } from "../dto/update-profile.dto";
import { UpdatePasswordDto } from "../dto/update-password.dto";
import { UpdateNotificationSettingsDto } from "../dto/update-notification-settings.dto";
import {
  ApiTags,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { ApiShopperEndpoint } from "src/common/decorators/api-audience.decorator";
import { GetUser } from "../../../common/decorators/get-user.decorator";
import { ApiResponse as ApiResponseInterface } from "../../../common/interfaces/response.interface";
import { JoiValidationPipe } from "../../../common/pipes/validation/joi_validate.pipe";
import { UpdateInterestsValidation } from "../validations/update-interests.validation";
import { UpdateProfileValidation } from "../validations/update-profile.validation";
import { UpdateNotificationSettingsValidation } from "../validations/update-notification-settings.validation";
import { UserRole } from "../enums/user-role.enum";
import RoleGuard from "src/common/guards/roles.guard";
import { SearchDto } from "../dto/search.dto";
import { ProductFiltersDto } from "../dto/filters.dto";
import { MongoIdPipe } from "../../shared/pipes/mongo-id.pipe";
import { BaseController } from "src/modules/shared/base/controller.base";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { CategoriesService } from "src/modules/categories/services/categories.service";

/**
 * Shopper-only surface. Every route here is guarded by `RoleGuard([UserRole.USER])`
 * at the class level, so vendors and admins receive 403 even with a valid token.
 */
@ApiTags("Users")
@Controller("users")
@ApiBearerAuth()
@UseGuards(RoleGuard([UserRole.USER]))
export class UsersController extends BaseController {
  constructor(
    private readonly usersService: UsersService,
    private readonly categoriesService: CategoriesService,
  ) {
    super();
  }

  @Get("home")
  @ApiShopperEndpoint({
    summary: "Get the shopper home feed",
    description:
      "Single call that backs the home screen: featured stores, product rails, deals, and categories, personalised from the authenticated shopper's interests and favourites.",
  })
  @ApiResponse({
    status: 200,
    description:
      "Returns home screen data including vendors, featured products, and deals",
  })
  async getHomeScreenData(
    @GetUser() user: { _id: string; role: string },
  ): Promise<ApiResponseInterface> {
    const data = await this.usersService.getHomeScreenData(user._id, user.role);
    return {
      status: HttpStatus.OK,
      message: "Home screen data retrieved successfully",
      data,
    };
  }

  @Get("new-and-hot")
  @ApiShopperEndpoint({
    summary: "Get the New & Hot feed",
    description:
      "Paginated discovery feed. The `tab` parameter selects the rail: `new-stores` for recently onboarded vendors, `hot-discount` for the steepest discounts, `trending-products` for the current best sellers.",
  })
  @ApiQuery({
    name: "tab",
    required: false,
    enum: ["new-stores", "hot-discount", "trending-products"],
    default: "new-stores",
  })
  @ApiQuery({ name: "page", required: false, type: Number, default: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, default: 10 })
  @ApiResponse({
    status: 200,
    description: "Paginated feed for the selected tab (items + meta)",
  })
  async getNewAndHot(
    @Query("tab") tab: string = "new-stores",
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @GetUser("_id") userId?: string,
    @GetUser("role") userRole?: string,
    @Res() res?: Response,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 10), 10) || 10);

    const result = await this.usersService.getNewAndHot(
      { tab, page, limit },
      userId,
      userRole,
    );

    return this.successResponse(res, result.description, result.data);
  }

  @Get("search")
  @ApiShopperEndpoint({
    summary: "Search stores and products",
    description:
      "Full-text search across product names and store names, returned paginated. Combine with `GET /users/filters` to narrow results by brand, price, or category.",
  })
  @ApiResponse({
    status: 200,
    description: "Returns paginated search results",
  })
  async search(
    @Query() searchDto: SearchDto,
    @GetUser() user: { _id: string; role: string },
  ): Promise<ApiResponseInterface> {
    const results = await this.usersService.search(
      searchDto,
      user._id,
      user.role,
    );
    return {
      status: HttpStatus.OK,
      message: "Search results retrieved successfully",
      data: results,
    };
  }

  @Get("categories")
  @ApiShopperEndpoint({
    summary: "List categories for the shopper apps",
    description:
      "Category list shaped for the shopper browse screen. `GET /categories` returns the same taxonomy without requiring a shopper token — prefer that one for anonymous storefront browsing.",
  })
  @ApiResponse({
    status: 200,
    description: "Returns all categories",
  })
  async getCategories(): Promise<ApiResponseInterface> {
    const categories = await this.usersService.getCategories();
    return {
      status: HttpStatus.OK,
      message: "Categories retrieved successfully",
      data: categories,
    };
  }

  @Get("categories/:categoryId/products")
  @ApiShopperEndpoint({
    summary: "List products in a category",
    description:
      "Paginated products for one category, each enriched with the shopper's favourite flag.",
  })
  @ApiParam({ name: "categoryId", description: "Category ObjectId" })
  @ApiResponse({
    status: 200,
    description: "Returns paginated products in the specified category",
  })
  @ApiResponse({ status: 404, description: "Category not found" })
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
  async getCategoryProducts(
    @Param("categoryId", MongoIdPipe) categoryId: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10,
    @GetUser("_id") userId: string,
  ): Promise<ApiResponseInterface> {
    const products = await this.usersService.getCategoryProducts(
      categoryId,
      {
        page,
        limit,
      },
      userId,
    );
    return {
      status: HttpStatus.OK,
      message: "Category products retrieved successfully",
      data: products,
    };
  }

  @Get("subcategories/:subcategoryId/products")
  @ApiShopperEndpoint({
    summary: "List products in a subcategory",
    description:
      "Paginated products for one subcategory, each enriched with the shopper's favourite flag.",
  })
  @ApiParam({ name: "subcategoryId", description: "Subcategory ObjectId" })
  @ApiResponse({
    status: 200,
    description: "Returns paginated products in the specified subcategory",
  })
  @ApiResponse({ status: 404, description: "Subcategory not found" })
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
  async getSubcategoryProducts(
    @Param("subcategoryId", MongoIdPipe) subcategoryId: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10,
    @GetUser("_id") userId: string,
  ): Promise<ApiResponseInterface> {
    const products = await this.usersService.getSubcategoryProducts(
      subcategoryId,
      { page, limit },
      userId,
    );
    return {
      status: HttpStatus.OK,
      message: "Subcategory products retrieved successfully",
      data: products,
    };
  }

  @Get("filters/brands")
  @ApiShopperEndpoint({
    summary: "List brands available for filtering",
    description:
      "Returns the distinct brands present in the catalog, optionally narrowed by `q`. Feeds the brand facet on the search and category screens.",
  })
  @ApiResponse({
    status: 200,
    description: "Returns list of available brands",
  })
  @ApiQuery({
    name: "q",
    required: false,
    type: String,
    description: "Search query for brands",
    example: "nike",
  })
  async getBrands(
    @Query("q") searchQuery?: string,
  ): Promise<ApiResponseInterface> {
    const brands = await this.usersService.getBrands(searchQuery);
    return {
      status: HttpStatus.OK,
      message: "Brands retrieved successfully",
      data: brands,
    };
  }

  @Get("filters/price-range")
  @ApiShopperEndpoint({
    summary: "Get the catalog price range",
    description:
      "Returns the lowest and highest product prices on the platform, used to set the bounds of the price slider.",
  })
  @ApiResponse({
    status: 200,
    description: "Returns minimum and maximum product prices",
  })
  async getPriceRange(): Promise<ApiResponseInterface> {
    const priceRange = await this.usersService.getPriceRange();
    return {
      status: HttpStatus.OK,
      message: "Price range retrieved successfully",
      data: priceRange,
    };
  }

  @Get("filters")
  @ApiShopperEndpoint({
    summary: "List products matching filters",
    description:
      "Paginated product search with facets applied — category, subcategory, brand, price range, and sort order. Read the available facet values from `GET /users/filters/brands` and `GET /users/filters/price-range`.",
  })
  @ApiResponse({
    status: 200,
    description: "Returns paginated products matching the filters",
  })
  async getFilteredProducts(
    @Query() filters: ProductFiltersDto,
    @GetUser("_id") userId: string,
  ): Promise<ApiResponseInterface> {
    const products = await this.usersService.getFilteredProducts(
      filters,
      userId,
    );
    return {
      status: HttpStatus.OK,
      message: "Filtered products retrieved successfully",
      data: products,
    };
  }

  @Get("interests")
  @ApiShopperEndpoint({
    summary: "List selectable interests",
    description:
      "Returns the fixed catalogue of interest labels a shopper can choose from during onboarding. Save the selection with `PATCH /users/interests`.",
  })
  @ApiResponse({
    status: 200,
    description: "Returns list of available interests",
    type: [String],
  })
  getAvailableInterests(): ApiResponseInterface {
    const interests = this.usersService.getAvailableInterests();
    return {
      status: HttpStatus.OK,
      message: "Available interests retrieved successfully",
      data: interests,
    };
  }

  @Patch("interests")
  @ApiShopperEndpoint({
    summary: "Save the shopper's interests",
    description:
      "Replaces the authenticated shopper's interest selection. Interests personalise the home feed, so this is usually called once during onboarding and again from account settings.",
  })
  @ApiBody({ type: UpdateInterestsDto })
  @ApiResponse({ status: 200, description: "Interests updated successfully" })
  @ApiResponse({
    status: 400,
    description: "One or more interests are not in the allowed list",
  })
  async updateInterests(
    @GetUser("_id") userId: string,
    @Body(new JoiValidationPipe(UpdateInterestsValidation))
    updateInterestsDto: UpdateInterestsDto,
  ): Promise<ApiResponseInterface> {
    const updatedUser = await this.usersService.updateInterests(
      userId,
      updateInterestsDto,
    );
    return {
      status: HttpStatus.OK,
      message: "User interests updated successfully",
      data: updatedUser,
    };
  }

  @Get("profile")
  @ApiShopperEndpoint({
    summary: "Get the shopper's profile",
    description:
      "Returns the authenticated shopper's name, email, phone, profile picture, interests, and notification settings.",
  })
  @ApiResponse({
    status: 200,
    description: "User profile retrieved successfully",
  })
  async getProfile(@GetUser("_id") userId: string, @Res() res: Response) {
    const result = await this.usersService.getProfile(userId);

    return this.successResponse(res, result.description, result.data);
  }

  @Patch("profile")
  @ApiShopperEndpoint({
    summary: "Update the shopper's profile",
    description:
      "Edits the authenticated shopper's details. Sent as `multipart/form-data` so a new avatar can be attached in the `profilePicture` field (max 5 MB) alongside the text fields. Omit the file to change text fields only.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  @ApiResponse({
    status: 400,
    description: "Validation failed, or the image exceeds 5 MB",
  })
  @UseInterceptors(
    FileInterceptor("profilePicture", {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    }),
  )
  async updateProfile(
    @GetUser("_id") userId: string,
    @Body(new JoiValidationPipe(UpdateProfileValidation))
    updateProfileDto: UpdateProfileDto,
    @Res() res: Response,
    @UploadedFile() profilePicture?: Express.Multer.File,
  ) {
    const result = await this.usersService.updateProfile(
      userId,
      updateProfileDto,
      profilePicture,
    );

    return this.successResponse(res, result.description, result.data);
  }

  @Patch("change-password")
  @ApiShopperEndpoint({
    summary: "Change the shopper's password",
    description:
      "Replaces the password on the authenticated shopper's account. The current password must be supplied and is verified before the change is applied.",
  })
  @ApiBody({ type: UpdatePasswordDto })
  @ApiResponse({
    status: 200,
    description: "Password updated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Current password is wrong, or the new password is too weak",
  })
  async updatePassword(
    @GetUser("_id") userId: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
    @Res() res: Response,
  ) {
    const result = await this.usersService.updatePassword(
      userId,
      updatePasswordDto,
    );

    return this.successResponse(res, result.description, result.data);
  }

  @Patch("notification-settings")
  @ApiShopperEndpoint({
    summary: "Update notification preferences",
    description:
      "Sets which channels (email, push, SMS) the authenticated shopper receives order updates and promotions on.",
  })
  @ApiBody({ type: UpdateNotificationSettingsDto })
  @ApiResponse({
    status: 200,
    description: "Notification settings updated successfully",
  })
  async updateNotificationSettings(
    @GetUser("_id") userId: string,
    @Body(new JoiValidationPipe(UpdateNotificationSettingsValidation))
    updateNotificationSettingsDto: UpdateNotificationSettingsDto,
    @Res() res: Response,
  ) {
    const result = await this.usersService.updateNotificationSettings(
      userId,
      updateNotificationSettingsDto,
    );

    return this.successResponse(res, result.description, result.data);
  }

  @Post("logout")
  @ApiShopperEndpoint({
    summary: "Log out and invalidate the token",
    description:
      "Bumps the shopper's token version so every access token issued before this call stops working. Clients should discard the stored token after a successful response.",
  })
  @ApiResponse({
    status: 200,
    description: "User logged out successfully",
  })
  async logout(@GetUser("_id") userId: string, @Res() res: Response) {
    const result = await this.usersService.logout(userId);

    return this.successResponse(res, result.description, result.data);
  }

  // --- Subcategories ---

  @Get("subcategories/all")
  @ApiShopperEndpoint({
    summary: "List every subcategory",
    description:
      "Flat list of all subcategories across all categories. `GET /categories/subcategories/all` returns the same data for anonymous callers.",
  })
  @ApiResponse({ status: 200, description: "Return all subcategories" })
  async findAllSubcategories(@Res() res: Response) {
    const result = await this.categoriesService.findAllSubcategories();
    if (result.failed) {
      return this.throwErrorRaw(
        result.description ?? "Failed to retrieve subcategories",
        result.code,
      );
    }
    return this.successResponse(
      res,
      result.description ?? "Subcategories retrieved successfully",
      result.data,
      HttpStatus.OK,
    );
  }

  @Get("/categories/:categoryId/subcategories")
  @ApiShopperEndpoint({
    summary: "List a category's subcategories",
    description:
      "Subcategories belonging to one category. `GET /categories/{categoryId}/subcategories` returns the same data for anonymous callers.",
  })
  @ApiParam({ name: "categoryId", description: "Category ObjectId" })
  @ApiResponse({ status: 200, description: "Return subcategories" })
  @ApiResponse({ status: 404, description: "Category not found" })
  async findSubcategoriesByCategoryId(
    @Param("categoryId", MongoIdPipe) categoryId: string,
    @Res() res: Response,
  ) {
    const result =
      await this.categoriesService.findSubcategoriesByCategoryId(categoryId);
    if (result.failed) {
      return this.throwErrorRaw(
        result.description ?? "Failed to retrieve subcategories",
        result.code,
      );
    }
    return this.successResponse(
      res,
      result.description ?? "Subcategories retrieved successfully",
      result.data,
      HttpStatus.OK,
    );
  }
}
