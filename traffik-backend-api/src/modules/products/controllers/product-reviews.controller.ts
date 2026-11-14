import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import {
  ApiAudience,
  ApiEndpoint,
  ApiPublicEndpoint,
  ApiShopperEndpoint,
} from "src/common/decorators/api-audience.decorator";
import { Response } from "express";
import { BaseController } from "src/modules/shared/base/controller.base";
import { MongoIdPipe } from "src/modules/shared/pipes/mongo-id.pipe";
import { OptionalJwtAuthGuard } from "src/common/guards/optional-jwt-auth.guard";
import RoleGuard from "src/common/guards/roles.guard";
import { UserRole } from "src/modules/users/enums/user-role.enum";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { JoiValidationPipe } from "src/common/pipes/validation/joi_validate.pipe";
import { ProductReviewsService } from "../services/product-reviews.service";
import { FilesService } from "../../files/services/files.service";
import {
  CreateProductReviewValidation,
  UpdateProductReviewValidation,
} from "../validations/product-review.validation";

/**
 * Reading reviews is open to anyone; writing, editing, deleting, and voting are
 * shopper-only via `RoleGuard([UserRole.USER])`.
 */
@ApiTags("Product reviews")
@Controller("products/:productId/reviews")
export class ProductReviewsController extends BaseController {
  constructor(
    private readonly productReviewsService: ProductReviewsService,
    private readonly filesService: FilesService,
  ) {
    super();
  }

  @Get("summary")
  @ApiPublicEndpoint({
    summary: "Get a product's rating summary",
    description:
      "Returns the average rating, total review count, and the count per star level, for the ratings block on the product page. Open so it renders before sign-in.",
  })
  @ApiParam({ name: "productId", description: "Product ObjectId" })
  @ApiResponse({ status: 200, description: "Summary returned" })
  @ApiResponse({ status: 404, description: "Product not found" })
  async getSummary(
    @Param("productId", MongoIdPipe) productId: string,
    @Res() res: Response,
  ) {
    const result = await this.productReviewsService.getSummary(productId);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER],
    summary: "List a product's reviews",
    description:
      "Paginated reviews for a product, newest first. Works anonymously; when a shopper token is sent, each review also indicates whether that shopper wrote it and whether they already voted it helpful.",
    optionalAuth: true,
  })
  @ApiParam({ name: "productId", description: "Product ObjectId" })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 10 })
  @ApiQuery({
    name: "itemsPerPage",
    required: false,
    type: Number,
    description: "Legacy alias for limit",
  })
  @ApiResponse({ status: 200, description: "Paginated reviews" })
  async listReviews(
    @Param("productId", MongoIdPipe) productId: string,
    @Res() res: Response,
    @GetUser() user?: { _id: string; role: string },
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @Query("itemsPerPage") itemsPerPageQuery?: string | number,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(
      1,
      parseInt(String(limitQuery ?? itemsPerPageQuery ?? 10), 10) || 10,
    );
    const result = await this.productReviewsService.listReviews(
      productId,
      { page, limit },
      user?._id,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post()
  @UseGuards(RoleGuard([UserRole.USER]))
  @UseInterceptors(FilesInterceptor("images", 3))
  @ApiConsumes("multipart/form-data")
  @ApiShopperEndpoint({
    summary: "Write a product review",
    description:
      "Posts a review for a product. Sent as `multipart/form-data` so up to three photos can be attached under `images`. Include `orderId` from `GET /orders/pending-reviews` to have the review marked as a verified purchase — that requires the order to be `DELIVERED` and to contain this product. A shopper may review a given product only once.",
  })
  @ApiParam({ name: "productId", description: "Product ObjectId" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        rating: { type: "integer", minimum: 1, maximum: 5 },
        comment: { type: "string" },
        images: {
          type: "array",
          items: { type: "string", format: "binary" },
          description: "Upload up to 3 images",
        },
        orderId: {
          type: "string",
          nullable: true,
          description:
            "Delivered order containing this product; marks the review as a verified purchase",
        },
      },
      required: ["rating"],
    },
  })
  @ApiResponse({ status: 201, description: "Review created" })
  @ApiResponse({
    status: 400,
    description:
      "Rating out of range, or the order is not valid for verification",
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  @ApiResponse({
    status: 409,
    description: "This shopper has already reviewed the product",
  })
  async createReview(
    @Param("productId", MongoIdPipe) productId: string,
    @GetUser() user: { _id: string; role: string },
    @Body(new JoiValidationPipe(CreateProductReviewValidation))
    body: {
      rating: number;
      comment: string;
      images: string[];
      orderId?: string;
    },
    @UploadedFiles() files: Express.Multer.File[],
    @Res() res: Response,
  ) {
    let imageUrls = body.images || [];

    if (files && files.length > 0) {
      const { uploaded } = await this.filesService.uploadMultipleFiles(
        files,
        user._id,
      );
      const newUrls = uploaded.map((f) => f.url);
      imageUrls = [...imageUrls, ...newUrls];
    }

    const result = await this.productReviewsService.createReview(
      productId,
      user,
      { ...body, images: imageUrls },
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(
      res,
      result.description,
      result.data,
      HttpStatus.CREATED,
    );
  }

  @Patch(":reviewId")
  @UseGuards(RoleGuard([UserRole.USER]))
  @UseInterceptors(FilesInterceptor("images", 3))
  @ApiConsumes("multipart/form-data")
  @ApiShopperEndpoint({
    summary: "Edit my review",
    description:
      "Updates a review written by the authenticated shopper. Only the fields present change. Newly attached `images` are appended to any URLs passed in the body.",
  })
  @ApiParam({ name: "productId", description: "Product ObjectId" })
  @ApiParam({ name: "reviewId", description: "Review ObjectId" })
  @ApiResponse({ status: 200, description: "Review updated" })
  @ApiResponse({
    status: 404,
    description: "Review not found or not written by the caller",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        rating: { type: "integer", minimum: 1, maximum: 5 },
        comment: { type: "string" },
        images: {
          type: "array",
          items: { type: "string", format: "binary" },
          description: "Upload up to 3 images to add/replace",
        },
      },
    },
  })
  async updateReview(
    @Param("productId", MongoIdPipe) productId: string,
    @Param("reviewId", MongoIdPipe) reviewId: string,
    @GetUser() user: { _id: string; role: string },
    @Body(new JoiValidationPipe(UpdateProductReviewValidation))
    body: { rating?: number; comment?: string; images?: string[] },
    @UploadedFiles() files: Express.Multer.File[],
    @Res() res: Response,
  ) {
    let imageUrls = body.images;

    if (files && files.length > 0) {
      const { uploaded } = await this.filesService.uploadMultipleFiles(
        files,
        user._id,
      );
      const newUrls = uploaded.map((f) => f.url);
      imageUrls = body.images ? [...body.images, ...newUrls] : newUrls;
    }

    const result = await this.productReviewsService.updateReview(
      productId,
      reviewId,
      user,
      { ...body, images: imageUrls },
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Delete(":reviewId")
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "Delete my review",
    description:
      "Removes a review written by the authenticated shopper and recalculates the product's rating summary.",
  })
  @ApiParam({ name: "productId", description: "Product ObjectId" })
  @ApiParam({ name: "reviewId", description: "Review ObjectId" })
  @ApiResponse({ status: 200, description: "Review deleted" })
  @ApiResponse({
    status: 404,
    description: "Review not found or not written by the caller",
  })
  async deleteReview(
    @Param("productId", MongoIdPipe) productId: string,
    @Param("reviewId", MongoIdPipe) reviewId: string,
    @GetUser() user: { _id: string; role: string },
    @Res() res: Response,
  ) {
    const result = await this.productReviewsService.deleteReview(
      productId,
      reviewId,
      user,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post(":reviewId/helpful")
  @UseGuards(RoleGuard([UserRole.USER]))
  @ApiShopperEndpoint({
    summary: "Vote a review helpful",
    description:
      "Increments the helpful count on another shopper's review. Each shopper may vote once per review, and cannot vote on their own review.",
  })
  @ApiParam({ name: "productId", description: "Product ObjectId" })
  @ApiParam({ name: "reviewId", description: "Review ObjectId" })
  @ApiResponse({ status: 200, description: "Vote recorded" })
  @ApiResponse({
    status: 400,
    description: "Already voted, or the review belongs to the caller",
  })
  @ApiResponse({ status: 404, description: "Review not found" })
  async markHelpful(
    @Param("productId", MongoIdPipe) productId: string,
    @Param("reviewId", MongoIdPipe) reviewId: string,
    @GetUser() user: { _id: string; role: string },
    @Res() res: Response,
  ) {
    const result = await this.productReviewsService.markHelpful(
      productId,
      reviewId,
      user,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }
}
