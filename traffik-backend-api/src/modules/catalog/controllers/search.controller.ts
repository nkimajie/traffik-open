import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import {
  ApiAudience,
  ApiEndpoint,
} from "src/common/decorators/api-audience.decorator";
import { OptionalJwtAuthGuard } from "src/common/guards/optional-jwt-auth.guard";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { BaseController } from "src/modules/shared/base/controller.base";
import { SearchService } from "../services/search.service";

@ApiTags("Catalog")
@Controller("search")
export class SearchController extends BaseController {
  constructor(private readonly searchService: SearchService) {
    super();
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiEndpoint({
    audience: [ApiAudience.PUBLIC, ApiAudience.SHOPPER],
    summary: "Search products and stores",
    description:
      "Unified storefront search. Use `type=products`, `type=vendors`, or omit for both. Works anonymously.",
    optionalAuth: true,
  })
  @ApiQuery({ name: "q", required: true, type: String })
  @ApiQuery({
    name: "type",
    required: false,
    enum: ["products", "vendors", "all"],
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Search results" })
  async search(
    @Res() res: Response,
    @Query("q") q: string,
    @Query("type") type?: "products" | "vendors" | "all",
    @Query("page") pageQuery?: string | number,
    @Query("limit") limitQuery?: string | number,
    @GetUser("_id") userId?: string,
  ) {
    const page = Math.max(1, parseInt(String(pageQuery ?? 1), 10) || 1);
    const limit = Math.max(1, parseInt(String(limitQuery ?? 20), 10) || 20);

    const result = await this.searchService.search(
      q,
      type ?? "all",
      { page, limit },
      userId,
    );

    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }

    return this.successResponse(res, result.description, result.data);
  }
}
