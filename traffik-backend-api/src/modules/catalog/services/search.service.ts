import { Injectable, Logger } from "@nestjs/common";
import { BaseService } from "src/modules/shared/base/service.base";
import { PromisifiedOperationFeedback } from "src/modules/shared/types/promisified_operation_feedback.type";
import { PaginationOptions } from "src/common/interfaces/pagination-options.interface";
import { ProductsService } from "src/modules/products/services/products.service";
import { VendorsService } from "src/modules/vendors/services/vendors.service";

@Injectable()
export class SearchService extends BaseService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly vendorsService: VendorsService,
  ) {
    super();
  }

  async search(
    q: string,
    type: "products" | "vendors" | "all",
    options: PaginationOptions,
    userId?: string,
  ): PromisifiedOperationFeedback<{
    products?: Awaited<ReturnType<ProductsService["search"]>>;
    vendors?: Awaited<ReturnType<VendorsService["search"]>>;
  }> {
    try {
      if (!q?.trim()) {
        return this.Result(true, "Search query is required", undefined, 400);
      }

      const searchQuery = { $regex: q.trim(), $options: "i" };
      const data: {
        products?: Awaited<ReturnType<ProductsService["search"]>>;
        vendors?: Awaited<ReturnType<VendorsService["search"]>>;
      } = {};

      if (type === "products" || type === "all") {
        data.products = await this.productsService.search(
          searchQuery,
          options,
          userId,
        );
      }

      if (type === "vendors" || type === "all") {
        data.vendors = await this.vendorsService.search(
          searchQuery,
          options,
          userId,
          userId ? "user" : undefined,
        );
      }

      return this.Result(false, "Search results retrieved successfully", data);
    } catch (error: any) {
      this.logger.error(`Search error: ${error?.message}`);
      return this.Result(true, "Search failed", undefined, 500);
    }
  }
}
