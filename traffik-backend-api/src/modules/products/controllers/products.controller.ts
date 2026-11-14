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
import { ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  ApiAudience,
  ApiEndpoint,
  ApiShopperEndpoint,
  ApiVendorEndpoint,
} from "src/common/decorators/api-audience.decorator";
import { Response } from "express";
import { ProductsService } from "../services/products.service";
import { CreateProductDto } from "../dto/create-product.dto";
import { ProductDocument } from "../schemas/product.schema";
import { MongoIdPipe } from "../../shared/pipes/mongo-id.pipe";
import { CreateProductValidation } from "../validations/create-product.validation";
import RoleGuard from "src/common/guards/roles.guard";
import { UserRole } from "src/modules/users/enums/user-role.enum";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { JoiValidationPipe } from "src/common/pipes/validation/joi_validate.pipe";
import { UpdateProductValidation } from "../validations/update-product.validation";
import { UpdateProductDto } from "../dto/update-product.dto";
import { BaseController } from "src/modules/shared/base/controller.base";
import { OptionalJwtAuthGuard } from "src/common/guards/optional-jwt-auth.guard";

/**
 * Mixed-audience controller. Catalog reads are open or optionally authenticated,
 * product management is vendor-only, and favourites are shopper-only. Each method
 * declares its own audience.
 */
@ApiTags("Products")
@Controller("products")
export class ProductsController extends BaseController {
  constructor(private readonly productsService: ProductsService) {
    super();
  }

  @Post()
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "Create a product",
    description:
      "Publishes a product to the authenticated vendor's store. Upload images first with `POST /files/upload` and reference the returned URLs. Products with variations (size, colour) carry their own stock and price per variation; products without variations carry a single stock and price.",
  })
  @ApiResponse({
    status: 201,
    description: "The product has been successfully created",
  })
  @ApiResponse({
    status: 400,
    description: "Validation failed, or the category does not exist",
  })
  @ApiResponse({
    status: 403,
    description: "Vendor store is not approved for product listing",
  })
  async create(
    @Body(new JoiValidationPipe(CreateProductValidation))
    createProductDto: CreateProductDto,
    @GetUser("_id") vendorId: string,
  ): Promise<ProductDocument> {
    return this.productsService.create(createProductDto, vendorId);
  }

  @Get()
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER],
    summary: "List all products",
    description:
      "Paginated catalog feed across every active store, newest first. Works anonymously; when a shopper token is sent, each item also carries the shopper's `isFavourite` flag.",
    optionalAuth: true,
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
    description:
      "Items per page (preferred). If omitted, itemsPerPage is used when sent.",
    example: 10,
  })
  @ApiQuery({
    name: "itemsPerPage",
    required: false,
    type: Number,
    description:
      "Legacy alias for limit; ignored when limit is present (same as orders API).",
    example: 10,
  })
  @ApiQuery({ name: "categoryId", required: false, type: String })
  @ApiQuery({ name: "subcategoryId", required: false, type: String })
  @ApiQuery({ name: "vendorId", required: false, type: String })
  @ApiQuery({ name: "q", required: false, type: String, description: "Search term" })
  @ApiQuery({ name: "minPrice", required: false, type: Number })
  @ApiQuery({ name: "maxPrice", required: false, type: Number })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: ["newest", "price-asc", "price-desc", "rating"],
  })
  @ApiResponse({
    status: 200,
    description:
      "Paginated products (items + meta); each item includes latestReview when present.",
  })
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(
    @Res() res: Response,
    @GetUser("_id") userId?: string,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("itemsPerPage") itemsPerPageQuery?: string | number,
    @Query("categoryId") categoryId?: string,
    @Query("subcategoryId") subcategoryId?: string,
    @Query("vendorId") vendorId?: string,
    @Query("q") q?: string,
    @Query("minPrice") minPriceQuery?: string | number,
    @Query("maxPrice") maxPriceQuery?: string | number,
    @Query("sort") sort?: "newest" | "price-asc" | "price-desc" | "rating",
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(
      1,
      parseInt(String(limitQuery ?? itemsPerPageQuery ?? 10), 10) || 10,
    );
    const minPrice =
      minPriceQuery != null && minPriceQuery !== ""
        ? parseFloat(String(minPriceQuery))
        : undefined;
    const maxPrice =
      maxPriceQuery != null && maxPriceQuery !== ""
        ? parseFloat(String(maxPriceQuery))
        : undefined;

    const result = await this.productsService.findAll(
      {
        page,
        limit,
        categoryId,
        subcategoryId,
        vendorId,
        q,
        minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
        maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
        sort,
      },
      userId,
    );

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get("deals")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER],
    summary: "List deal products",
    description:
      "Paginated feed of active products with discounts (hot deals). Works anonymously; favourite flags included when a shopper token is sent.",
    optionalAuth: true,
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Paginated deal products" })
  async getDeals(
    @Res() res: Response,
    @GetUser("_id") userId?: string,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 20), 10) || 20);
    const result = await this.productsService.findHotDiscounts(
      { page, limit },
      userId,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get("featured")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER],
    summary: "List featured products",
    description:
      "Active featured products for home-page rails. Works anonymously; favourite flags included when a shopper token is sent.",
    optionalAuth: true,
  })
  @ApiResponse({ status: 200, description: "Featured products array" })
  async getFeatured(
    @Res() res: Response,
    @GetUser("_id") userId?: string,
  ) {
    const items = await this.productsService.findFeatured(userId);
    return this.successResponse(res, "Featured products retrieved", items);
  }

  @Get("trending")
  @UseGuards(RoleGuard([UserRole.USER, UserRole.ADMIN]))
  @ApiEndpoint({
    audience: [ApiAudience.SHOPPER, ApiAudience.ADMIN],
    summary: "List trending products",
    description:
      "Active products ranked by how many distinct non-cancelled orders include them, with `orderCount` on each item. Shoppers see it as a home rail; admins use it to read demand.",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Max items to return (default 10, max 50)",
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description:
      "items: enriched products with orderCount, isFavourite, latestReview (same shape as GET /products items)",
  })
  async getTrendingProducts(
    @Res() res: Response,
    @GetUser("_id") userId: string,
    @Query("limit") limitQuery?: string | number,
  ) {
    const limit = Math.min(
      50,
      Math.max(1, parseInt(String(limitQuery ?? 10), 10) || 10),
    );
    const result = await this.productsService.findTrending({ limit }, userId);

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get("vendor/me")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "List my products",
    description:
      "Paginated products belonging to the authenticated vendor, including drafts and inactive listings. This is the vendor portal's product table; use `GET /products/vendor/{vendorId}/products` for the public storefront view of a store.",
  })
  @ApiResponse({
    status: 200,
    description: "Return vendor's products with pagination",
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
    description: "Items per page (preferred)",
    example: 10,
  })
  @ApiQuery({
    name: "itemsPerPage",
    required: false,
    type: Number,
    description: "Legacy alias for limit; ignored when limit is present",
    example: 10,
  })
  async findVendorProducts(
    @GetUser("_id") vendorId: string,
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("itemsPerPage") itemsPerPageQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(
      1,
      parseInt(String(limitQuery ?? itemsPerPageQuery ?? 10), 10) || 10,
    );
    const result = await this.productsService.findByVendorId(vendorId, {
      page,
      limit,
    });

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get("vendor/:vendorId/products")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER],
    summary: "List a store's products",
    description:
      "Paginated **active** products for one store — the storefront store page. Filter to a single category with `categoryId`. Works anonymously; a shopper token adds the `isFavourite` flag to each item.",
    optionalAuth: true,
  })
  @ApiParam({ name: "vendorId", description: "Vendor (store) ObjectId" })
  @ApiResponse({
    status: 200,
    description: "Returns paginated list of products for a specified vendor",
  })
  @ApiResponse({ status: 404, description: "Vendor not found" })
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
    description: "Items per page (preferred)",
    example: 10,
  })
  @ApiQuery({
    name: "itemsPerPage",
    required: false,
    type: Number,
    description: "Legacy alias for limit; ignored when limit is present",
    example: 10,
  })
  @ApiQuery({
    name: "categoryId",
    required: false,
    type: String,
    description: "Filter by product category (active products only)",
  })
  async findPublicVendorProducts(
    @Param("vendorId", MongoIdPipe) vendorId: string,
    @Res() res: Response,
    @GetUser("_id") userId?: string,
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
    const result = await this.productsService.findByVendorId(
      vendorId,
      { page, limit, activeOnly: true, ...(categoryId ? { categoryId } : {}) },
      userId,
    );

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get("vendor/:vendorId/product-categories")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER],
    summary: "List a store's product categories",
    description:
      "Distinct active categories that have at least one active product in this store. These are the category tabs shown on the storefront store page.",
    optionalAuth: true,
  })
  @ApiParam({
    name: "vendorId",
    description: "Vendor (store) ObjectId",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "data.categories: { id, name }[] sorted by name",
  })
  async getVendorProductCategories(
    @Param("vendorId", MongoIdPipe) vendorId: string,
    @Res() res: Response,
  ) {
    const result =
      await this.productsService.getVendorProductCategories(vendorId);

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Post("vendor/edit/:id")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "Update my product",
    description:
      "Edits a product owned by the authenticated vendor — price, stock, images, status, or variations. Only the fields present in the body change. Note this is a `POST`, not a `PATCH`.",
  })
  @ApiParam({ name: "id", description: "Product ObjectId" })
  @ApiResponse({
    status: 200,
    description: "Product updated successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Product not found or not owned by the caller",
  })
  async editProduct(
    @Param("id", MongoIdPipe) id: string,
    @GetUser() vendor: any,
    @Body(new JoiValidationPipe(UpdateProductValidation))
    updateProductDto: UpdateProductDto,
    @Res() res: Response,
  ) {
    const product = await this.productsService.update(
      id,
      vendor._id,
      updateProductDto,
    );
    return this.successResponse(res, "Product updated successfully", product);
  }

  @Patch("save-product-as-favorite/:productId")
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "Save a product to favourites",
    description:
      "Adds a product to the authenticated shopper's saved items. Read the list back with `GET /products/user/saved-products`.",
  })
  @ApiParam({
    name: "productId",
    description: "Product ObjectId",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Product saved as favorite successfully",
  })
  @ApiResponse({ status: 404, description: "Product not found or not active" })
  async saveProductAsFavorite(
    @Param("productId", MongoIdPipe) productId: string,
    @GetUser("_id") userId: string,
    @Res() res: Response,
  ) {
    const result = await this.productsService.saveProductAsFavorite(
      userId,
      productId,
    );

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Patch("remove-product-as-favorite/:productId")
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "Remove a product from favourites",
    description:
      "Takes a product out of the authenticated shopper's saved items.",
  })
  @ApiParam({
    name: "productId",
    description: "Product ObjectId",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Product removed from favorites successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Product is not in your favorites or already removed",
  })
  async removeProductAsFavorite(
    @Param("productId", MongoIdPipe) productId: string,
    @GetUser("_id") userId: string,
    @Res() res: Response,
  ) {
    const result = await this.productsService.removeProductAsFavorite(
      userId,
      productId,
    );

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get("user/saved-products")
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "List my saved products",
    description:
      "Paginated products the authenticated shopper has favourited, in the same item shape as `GET /products`. Backs the Saved items screen.",
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
    description:
      "Items per page (preferred). If omitted, itemsPerPage is used when sent.",
    example: 10,
  })
  @ApiQuery({
    name: "itemsPerPage",
    required: false,
    type: Number,
    description:
      "Legacy alias for limit; ignored when limit is present (same as GET /products).",
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description:
      "Paginated saved products: items + meta { total, page, limit, totalPages } (same shape as GET /products).",
  })
  async getUserSavedProducts(
    @GetUser("_id") userId: string,
    @Res() res: Response,
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("itemsPerPage") itemsPerPageQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(
      1,
      parseInt(String(limitQuery ?? itemsPerPageQuery ?? 10), 10) || 10,
    );
    const result = await this.productsService.getUserSavedProducts(userId, {
      page,
      itemsPerPage: limit,
    });

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get("user/saved-products/grouped")
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "List my saved products grouped by store",
    description:
      "The authenticated shopper's saved products organised under the store that sells them, with each store's opening hours so the client can show whether it is open. Backs the Saved items screen: because a cart holds one store at a time, saved items are ordered store by store.",
  })
  @ApiResponse({
    status: 200,
    description:
      "Array of { vendor, productCount, products }, sorted by store name, with each store's products most-recently-saved first. Unpaginated.",
  })
  async getUserSavedProductsGrouped(
    @GetUser("_id") userId: string,
    @Res() res: Response,
  ) {
    const result =
      await this.productsService.getUserSavedProductsGroupedByStore(userId);

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }

  @Get("vendor/:id")
  @UseGuards(RoleGuard([UserRole.VENDOR]))
  @ApiVendorEndpoint({
    summary: "Get one of my products",
    description:
      "Returns a single product owned by the authenticated vendor, including inactive listings. This is the edit-form loader in the vendor portal; the public equivalent is `GET /products/{id}`.",
  })
  @ApiParam({ name: "id", description: "Product ObjectId" })
  @ApiResponse({ status: 200, description: "Return the vendor's product" })
  @ApiResponse({
    status: 404,
    description: "Product not found or not owned by the caller",
  })
  async findVendorProduct(
    @Param("id", MongoIdPipe) id: string,
    @GetUser("_id") vendorId: string,
    @Res() res: Response,
  ) {
    const product = await this.productsService.findVendorProduct(id, vendorId);
    return this.successResponse(res, "Product retrieved successfully", product);
  }

  @Get(":id")
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER],
    summary: "Get a product by id",
    description:
      "Full product detail for the storefront product page: images, variations, stock, store, and `latestReview` (the newest review, or null). Works anonymously; a shopper token adds the `isFavourite` flag.",
    optionalAuth: true,
  })
  @ApiParam({ name: "id", description: "Product ObjectId" })
  @ApiResponse({ status: 200, description: "Return the product" })
  @ApiResponse({ status: 404, description: "Product not found" })
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(
    @Param("id", MongoIdPipe) id: string,
    @Res() res: Response,
    @GetUser("_id") userId?: string,
  ) {
    const product = await this.productsService.findById(id, userId);
    return this.successResponse(res, "Product retrieved successfully", product);
  }
}
