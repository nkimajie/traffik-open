import {
  BadRequestException,
  ConflictException,
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ProductsRepository } from "../repositories/products.repository";
import { CreateProductDto } from "../dto/create-product.dto";
import { ProductDocument } from "../schemas/product.schema";
import { CategoriesService } from "../../categories/services/categories.service";
import { PaginationOptions } from "src/common/interfaces/pagination-options.interface";
import { PaginatedResponse } from "src/common/interfaces/paginated-response.interface";
import {
  IProduct,
  IProductVariation,
  IDefaultVariation,
  IProductDiscount,
} from "../interfaces/product.interface";
import { SavedProductsByStore } from "../interfaces/saved-products-by-store.interface";
import {
  applyProductDiscount,
  cloneProductDiscount,
  isActiveProductDiscount,
  enrichProductWithFinalPrice,
} from "../utils/product-discount.util";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { UpdateProductDto } from "../dto/update-product.dto";
import {
  ProductStockEdit,
  StockConflict,
} from "../interfaces/product-stock-edit.interface";
import { planProductStockEdit } from "../utils/product-stock-edit.util";
import { PRODUCT_EDIT_MAX_ATTEMPTS } from "../constants/product-stock.constant";
import { FilesService } from "../../files/services/files.service";
import { FileUploadsRepository } from "../../files/repositories/file-uploads.repository";
import { FilterQuery, PipelineStage, Types } from "mongoose";
import { ProductStatus } from "../enums/product-status.enum";
import { ProductGender } from "../enums/product-gender.enum";
import { BaseService } from "src/modules/shared/base/service.base";
import { UsersFavouriteProductRepository } from "src/modules/shared/repositories/users-favourite-product.repository";
import { PromisifiedOperationFeedback } from "src/modules/shared/types/promisified_operation_feedback.type";
import { DBCollectionNames } from "src/modules/shared/enums/db_collections_name.enum";
import { IPaginationQuery } from "src/modules/shared/interfaces/pagination_query.interface";
import {
  ProductReviewsService,
  ProductReviewListItem,
} from "./product-reviews.service";
import { OrdersService } from "src/modules/orders/services/orders.service";
import { VendorsRepository } from "src/modules/vendors/repositories/vendors.repository";
import {
  ProductListFilters,
  ProductSortOption,
} from "../interfaces/product-list-filters.interface";

interface BrandQuery {
  isActive: boolean;
  brand: {
    $exists: boolean;
    $ne: string;
    $regex?: string;
    $options?: string;
  };
}

interface PriceRangeResult {
  _id: null;
  minPrice: number;
  maxPrice: number;
}

/** Resolved line pricing for cart / checkout (from {@link ProductsService.resolveCartUnitPrice}). */
export interface CartPriceResolution {
  unitPrice: number;
  listUnitPrice: number;
  appliedDiscount: IProductDiscount | null;
}

@Injectable()
export class ProductsService extends BaseService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly categoriesService: CategoriesService,
    private readonly utilsService: UtilsService,
    private readonly filesService: FilesService,
    private readonly fileUploadsRepository: FileUploadsRepository,
    private readonly usersFavouriteProductRepository: UsersFavouriteProductRepository,
    private readonly productReviewsService: ProductReviewsService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly vendorsRepository: VendorsRepository,
  ) {
    super();
  }

  /** Batches latest review per product; leaves latestReview null when none. */
  private async mergeLatestReviewsIntoProducts<T extends { _id?: unknown }>(
    products: T[],
    userId?: string,
  ): Promise<Array<T & { latestReview: ProductReviewListItem | null }>> {
    if (!products.length) {
      return [];
    }
    const ids = products.map((p) => String(p._id));
    const reviewMap =
      await this.productReviewsService.getLatestReviewMapForProductIds(
        ids,
        userId,
      );
    return products.map((p) => ({
      ...p,
      latestReview: reviewMap.get(String(p._id)) ?? null,
    }));
  }

  private get vendorLookupStages() {
    return [
      {
        $lookup: {
          from: DBCollectionNames.VENDORS,
          let: { vId: "$vendorId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$vId"] } } },
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                businessName: 1,
                storeLogo: { $ifNull: ["$storeLogo", null] },
                physicalStore: 1,
                physicalStoreAddress: { $ifNull: ["$physicalStoreAddress", null] },
                businessCategory: { $ifNull: ["$businessCategory", null] },
                // website: { $ifNull: ["$website", null] },
                description: { $ifNull: ["$description", null] },
                // profilePicture: { $ifNull: ["$profilePicture", null] },
                // isActive: { $ifNull: ["$isActive", false] },
                isFeatured: { $ifNull: ["$isFeatured", false] },
                storeCoverPhoto: { $ifNull: ["$storeCoverPhoto", null] },
                businessHours: { $ifNull: ["$businessHours", null] },
                // rating: { $ifNull: ["$rating", 0] },
                // totalRatings: { $ifNull: ["$totalRatings", 0] },
                isVerified: { $ifNull: ["$isVerified", false] },
              },
            },
          ],
          as: "vendor",
        },
      },
      {
        $unwind: {
          path: "$vendor",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
  }

  private getFavouriteLookupStages(userId?: string) {
    if (!userId) {
      return [{ $addFields: { isFavourite: false } }];
    }

    return [
      {
        $lookup: {
          from: DBCollectionNames.USERS_FAVORITE_PRODUCTS,
          let: { pId: "$_id" },
          pipeline: [
            {
              $match: {
                isActive: true,
                $expr: {
                  $and: [
                    {
                      $eq: [
                        "$userId",
                        this.utilsService.objectIdFromString(userId),
                      ],
                    },
                    { $eq: ["$productId", "$$pId"] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "favouriteData",
        },
      },
      {
        $addFields: {
          isFavourite: { $gt: [{ $size: "$favouriteData" }, 0] },
        },
      },
      {
        $project: {
          favouriteData: 0,
        },
      },
    ];
  }

  /**
   * Normalizes legacy products (missing gender/subcategoryId) and attaches
   * category / subcategory { id, name } from lookups.
   */
  private get productCategorySubcategoryEnrichmentStages(): PipelineStage[] {
    const allowedGenders = Object.values(ProductGender);
    return [
      {
        $addFields: {
          subcategoryId: { $ifNull: ["$subcategoryId", null] },
          gender: {
            $let: {
              vars: {
                g: { $ifNull: ["$gender", null] },
                gtype: { $type: { $ifNull: ["$gender", null] } },
              },
              in: {
                $switch: {
                  branches: [
                    {
                      case: { $eq: ["$$gtype", "null"] },
                      then: null,
                    },
                    {
                      case: { $eq: ["$$gtype", "string"] },
                      then: {
                        $cond: [
                          { $in: ["$$g", allowedGenders] },
                          "$$g",
                          null,
                        ],
                      },
                    },
                    {
                      case: { $eq: ["$$gtype", "array"] },
                      then: {
                        $let: {
                          vars: {
                            arr: { $ifNull: ["$$g", []] },
                          },
                          in: {
                            $cond: [
                              { $eq: [{ $size: "$$arr" }, 0] },
                              null,
                              {
                                $let: {
                                  vars: {
                                    first: { $arrayElemAt: ["$$arr", 0] },
                                  },
                                  in: {
                                    $cond: [
                                      { $eq: [{ $type: "$$first" }, "string"] },
                                      {
                                        $cond: [
                                          { $in: ["$$first", allowedGenders] },
                                          "$$first",
                                          null,
                                        ],
                                      },
                                      null,
                                    ],
                                  },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                  default: null,
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: DBCollectionNames.CATEGORIES,
          let: { cid: "$categoryId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$cid"] } } },
            { $project: { _id: 1, name: 1 } },
            { $limit: 1 },
          ],
          as: "_categoryRow",
        },
      },
      {
        $lookup: {
          from: DBCollectionNames.SUBCATEGORIES,
          let: { sid: "$subcategoryId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ["$$sid", null] },
                    { $eq: ["$_id", "$$sid"] },
                  ],
                },
              },
            },
            { $project: { _id: 1, name: 1 } },
            { $limit: 1 },
          ],
          as: "_subcategoryRow",
        },
      },
      {
        $addFields: {
          category: {
            $cond: [
              { $gt: [{ $size: "$_categoryRow" }, 0] },
              {
                id: {
                  $toString: { $arrayElemAt: ["$_categoryRow._id", 0] },
                },
                name: { $arrayElemAt: ["$_categoryRow.name", 0] },
              },
              null,
            ],
          },
          subcategory: {
            $cond: [
              {
                $and: [
                  { $ne: ["$subcategoryId", null] },
                  { $gt: [{ $size: "$_subcategoryRow" }, 0] },
                ],
              },
              {
                id: {
                  $toString: { $arrayElemAt: ["$_subcategoryRow._id", 0] },
                },
                name: { $arrayElemAt: ["$_subcategoryRow.name", 0] },
              },
              null,
            ],
          },
        },
      },
      {
        $project: {
          _categoryRow: 0,
          _subcategoryRow: 0,
        },
      },
    ];
  }

  /**
   * Builds defaultVariation when product has no variations (hasVariations false).
   * Used internally for cart and order processing.
   */
  private normalizeAttributeRecord(
    attrs: Record<string, string> | Record<string, unknown> | undefined,
  ): Record<string, string> {
    if (!attrs || typeof attrs !== "object") {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (value != null && typeof value !== "object") {
        out[key] = String(value);
      }
    }
    if (typeof out.color === "string") {
      out.color = out.color.toLowerCase();
    }
    return out;
  }

  private buildDefaultVariation(
    productName: string,
    amount: number,
    quantity: number = 0,
    attributes: Record<string, string> | Record<string, unknown> = {},
  ): IDefaultVariation {
    return {
      name: productName,
      attributes: this.normalizeAttributeRecord(attributes),
      price: amount,
      quantity,
    };
  }

  resolveCartUnitPrice(
    product: ProductDocument,
    variationId?: string | null,
  ): CartPriceResolution {
    let base = 0;

    if (product.hasVariations && product.variations?.length) {
      const vid = variationId?.toString?.() ?? variationId;
      const variation = (product.variations as Array<{ _id?: unknown }>).find(
        (v) => v._id && String(v._id) === vid,
      );
      if (variation) {
        base = (variation as IProductVariation).price ?? product.amount ?? 0;
      } else {
        base = product.amount ?? 0;
      }
    } else {
      base = product.defaultVariation?.price ?? product.amount ?? 0;
    }

    let appliedDiscount: IProductDiscount | null = null;
    if (isActiveProductDiscount(product.discount)) {
      appliedDiscount = cloneProductDiscount(product.discount);
    }

    const listUnitPrice = base;
    const unitPrice = applyProductDiscount(base, appliedDiscount);

    return {
      unitPrice,
      listUnitPrice,
      appliedDiscount,
    };
  }

  async create(
    createProductDto: CreateProductDto,
    vendorId: string,
  ): Promise<ProductDocument> {
    try {
      const vendor = await this.vendorsRepository.query({ _id: vendorId });
      if (!vendor?.isApproved) {
        throw new HttpException(
          {
            statusCode: HttpStatus.FORBIDDEN,
            message:
              "Your store must be approved before you can list products",
            code: "VENDOR_NOT_APPROVED",
          },
          HttpStatus.FORBIDDEN,
        );
      }

      const categoryCheck = await this.categoriesService.findById(
        createProductDto.categoryId,
      );
      if (categoryCheck.failed) {
        throw new NotFoundException(
          categoryCheck.description ?? "Category not found",
        );
      }

      // Handle image updates
      if (createProductDto.images) {
        if (createProductDto.images.length > 0) {
          for (const imageUrl of createProductDto.images) {
            // Find the file record to get the publicId
            const fileRecord = await this.fileUploadsRepository.query({
              url: imageUrl,
              userId: vendorId,
            });
            if (fileRecord) {
              await this.filesService.markFileAsInUse(
                fileRecord.publicId,
                vendorId,
              );
            }
          }
        }
      }

      if (Array.isArray(createProductDto.variations)) {
        createProductDto.variations.forEach((vari) => {
          if (vari.attributes && typeof vari.attributes.color === "string") {
            vari.attributes.color = vari.attributes.color.toLowerCase();
          }
        });
      }

      const hasExplicitVariations =
        (createProductDto.variations?.length ?? 0) > 0;

      const { attributes: _omitAttributes, ...createBody } = createProductDto;

      const product = await this.productsRepository.create({
        ...createBody,
        vendorId,
        variations: hasExplicitVariations ? createProductDto.variations : [],
        defaultVariation: hasExplicitVariations
          ? undefined
          : this.buildDefaultVariation(
            createProductDto.name,
            createProductDto.amount,
            createProductDto.quantity ?? 0,
            createProductDto.attributes ?? {},
          ),
        hasVariations: hasExplicitVariations,
      });
      return this.findById(product._id.toString());
    } catch (error) {
      this.logger.error(`Error creating product: ${error.message}`);
      throw error;
    }
  }

  private buildProductListFilter(
    filters: ProductListFilters = {},
  ): FilterQuery<ProductDocument> {
    const filter: FilterQuery<ProductDocument> = {
      status: ProductStatus.ACTIVE,
    };

    if (filters.categoryId) {
      filter.categoryId = this.utilsService.objectIdFromString(
        filters.categoryId,
      );
    }
    if (filters.subcategoryId) {
      filter.subcategoryId = this.utilsService.objectIdFromString(
        filters.subcategoryId,
      );
    }
    if (filters.vendorId) {
      filter.vendorId = this.utilsService.objectIdFromString(filters.vendorId);
    }
    if (filters.minPrice != null || filters.maxPrice != null) {
      filter.amount = {};
      if (filters.minPrice != null) {
        (filter.amount as Record<string, number>).$gte = filters.minPrice;
      }
      if (filters.maxPrice != null) {
        (filter.amount as Record<string, number>).$lte = filters.maxPrice;
      }
    }
    if (filters.q?.trim()) {
      const regex = { $regex: filters.q.trim(), $options: "i" };
      filter.$or = [{ name: regex }, { description: regex }];
    }

    return filter;
  }

  private productListSortStage(
    sort: ProductSortOption = "newest",
  ): Record<string, 1 | -1> {
    switch (sort) {
      case "price-asc":
        return { amount: 1 };
      case "price-desc":
        return { amount: -1 };
      case "rating":
        return { rating: -1, totalRatings: -1 };
      default:
        return { createdAt: -1 };
    }
  }

  async findAll(
    options: PaginationOptions & ProductListFilters = { page: 1, limit: 10 },
    userId?: string,
  ): PromisifiedOperationFeedback<PaginatedResponse<IProduct>> {
    try {
      const {
        page = 1,
        limit = 10,
        categoryId,
        subcategoryId,
        vendorId,
        q,
        minPrice,
        maxPrice,
        sort,
      } = options;
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.max(1, Number(limit) || 10);
      const filter = this.buildProductListFilter({
        categoryId,
        subcategoryId,
        vendorId,
        q,
        minPrice,
        maxPrice,
      });
      const sortStage = this.productListSortStage(sort);

      const [result, total] = await Promise.all([
        this.productsRepository.aggregate<ProductDocument>(
          filter,
          [
            ...this.vendorLookupStages,
            ...this.productCategorySubcategoryEnrichmentStages,
            ...this.getFavouriteLookupStages(userId),
            { $sort: sortStage },
          ],
          {},
          { page: pageNum, itemsPerPage: limitNum },
        ),
        this.productsRepository.count(filter),
      ]);

      const totalNum = Number(total);
      const totalPages = Math.max(1, Math.ceil(totalNum / limitNum));

      const enriched = ((result?.items || []) as IProduct[]).map(
        enrichProductWithFinalPrice,
      );
      const items = await this.mergeLatestReviewsIntoProducts(enriched, userId);

      const response: PaginatedResponse<
        IProduct & { latestReview: ProductReviewListItem | null }
      > = {
        items,
        meta: {
          total: totalNum,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
      };

      return this.Result(false, "Products retrieved successfully", response);
    } catch (error: any) {
      this.logger.error(`Error finding products: ${error?.message}`);
      return this.Result(true, "Failed to retrieve products", undefined, 500);
    }
  }

  async findHotDiscounts(
    options: PaginationOptions = { page: 1, limit: 10 },
    userId?: string,
  ): PromisifiedOperationFeedback<PaginatedResponse<IProduct>> {
    try {
      const { page = 1, limit = 10 } = options;
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.max(1, Number(limit) || 10);
      
      const filter = {
        status: ProductStatus.ACTIVE,
        "discount.amount": { $gt: 0 },
        "discount.type": { $exists: true, $ne: null },
      };

      const [result, total] = await Promise.all([
        this.productsRepository.aggregate<ProductDocument>(
          filter,
          [
            ...this.vendorLookupStages,
            ...this.productCategorySubcategoryEnrichmentStages,
            ...this.getFavouriteLookupStages(userId),
            { $sort: { "discount.amount": -1, createdAt: -1 } },
          ],
          {},
          { page: pageNum, itemsPerPage: limitNum },
        ),
        this.productsRepository.count(filter),
      ]);

      const totalNum = Number(total);
      const totalPages = Math.max(1, Math.ceil(totalNum / limitNum));

      const enriched = ((result?.items || []) as IProduct[]).map(
        enrichProductWithFinalPrice,
      );
      const items = await this.mergeLatestReviewsIntoProducts(enriched, userId);

      const response: PaginatedResponse<
        IProduct & { latestReview: ProductReviewListItem | null }
      > = {
        items,
        meta: {
          total: totalNum,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
      };

      return this.Result(false, "Hot discount products retrieved successfully", response);
    } catch (error: any) {
      this.logger.error(`Error finding hot discounts: ${error?.message}`);
      return this.Result(true, "Failed to retrieve hot discount products", undefined, 500);
    }
  }

  /**
   * Active products ranked by number of distinct non-cancelled orders that include them.
   */
  async findTrending(
    options: { limit?: number } = {},
    userId?: string,
  ): PromisifiedOperationFeedback<{
    items: Array<
      IProduct & {
        orderCount: number;
        latestReview: ProductReviewListItem | null;
      }
    >;
  }> {
    try {
      const limitNum = Math.min(50, Math.max(1, Number(options.limit) || 10));
      const oversample = Math.min(500, limitNum * 8);

      const rankings =
        await this.ordersService.getTopProductIdsByDistinctOrderCount(
          oversample,
        );

      if (!rankings.length) {
        return this.Result(false, "Trending products retrieved", { items: [] });
      }

      const oids = rankings.map((r) => r.productId);
      const pipeline: PipelineStage[] = [
        { $match: { _id: { $in: oids }, status: ProductStatus.ACTIVE } },
        ...this.vendorLookupStages,
        ...this.productCategorySubcategoryEnrichmentStages,
        ...this.getFavouriteLookupStages(userId),
      ];

      const docs = await this.productsRepository.model
        .aggregate<ProductDocument>(pipeline)
        .exec();

      const byId = new Map(docs.map((d) => [String(d._id), d as IProduct]));

      const ordered: Array<IProduct & { orderCount: number }> = [];
      for (const row of rankings) {
        const doc = byId.get(String(row.productId));
        if (!doc) {
          continue;
        }
        ordered.push({
          ...enrichProductWithFinalPrice(doc),
          orderCount: row.orderCount,
        });
        if (ordered.length >= limitNum) {
          break;
        }
      }

      const items = await this.mergeLatestReviewsIntoProducts(ordered, userId);

      return this.Result(false, "Trending products retrieved", { items });
    } catch (error: any) {
      this.logger.error(`findTrending: ${error?.message}`);
      return this.Result(
        true,
        "Failed to load trending products",
        undefined,
        500,
      );
    }
  }

  async findById(
    id: string,
    userId?: string,
    options?: { attachLatestReview?: boolean },
  ): Promise<ProductDocument> {
    try {
      const result = await this.productsRepository.aggregate<ProductDocument>(
        { _id: this.utilsService.objectIdFromString(id) },
        [
          ...this.vendorLookupStages,
          ...this.productCategorySubcategoryEnrichmentStages,
          ...this.getFavouriteLookupStages(userId),
        ],
        {},
        { page: 1, itemsPerPage: 1 },
      );
      const product = result.items[0];
      if (!product) {
        throw new NotFoundException("Product not found");
      }
      const enriched = enrichProductWithFinalPrice(product) as ProductDocument;
      const attach = options?.attachLatestReview !== false;
      if (!attach) {
        return enriched;
      }
      const [merged] = await this.mergeLatestReviewsIntoProducts(
        [enriched],
        userId,
      );
      return merged as ProductDocument;
    } catch (error) {
      this.logger.error(`Error finding product: ${error.message}`);
      throw error;
    }
  }

  async findVendorProduct(
    id: string,
    vendorId: string,
    userId?: string,
  ): Promise<ProductDocument> {
    try {
      const result = await this.productsRepository.aggregate<ProductDocument>(
        {
          _id: this.utilsService.objectIdFromString(id),
          vendorId: this.utilsService.objectIdFromString(vendorId),
        },
        [
          ...this.vendorLookupStages,
          ...this.productCategorySubcategoryEnrichmentStages,
          ...this.getFavouriteLookupStages(userId),
        ],
        {},
        { page: 1, itemsPerPage: 1 },
      );
      const product = result.items[0];
      if (!product) {
        throw new NotFoundException("Product not found");
      }
      const enriched = enrichProductWithFinalPrice(product) as ProductDocument;
      const [merged] = await this.mergeLatestReviewsIntoProducts(
        [enriched],
        userId,
      );
      return merged as ProductDocument;
    } catch (error) {
      this.logger.error(`Error finding vendor product: ${error.message}`);
      throw error;
    }
  }

  /**
   * Distinct active categories that have at least one ACTIVE product for this vendor (for storefront tabs).
   */
  async getStoreCategoryTabsForVendor(
    vendorId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const vid = this.utilsService.objectIdFromString(vendorId);
    const rows = await this.productsRepository.model
      .aggregate<{ id: string; name: string }>([
        {
          $match: {
            vendorId: vid,
            status: ProductStatus.ACTIVE,
          },
        },
        { $group: { _id: "$categoryId" } },
        {
          $lookup: {
            from: DBCollectionNames.CATEGORIES,
            localField: "_id",
            foreignField: "_id",
            as: "cat",
          },
        },
        { $unwind: "$cat" },
        { $match: { "cat.isActive": true } },
        {
          $project: {
            _id: 0,
            id: { $toString: "$cat._id" },
            name: "$cat.name",
          },
        },
        { $sort: { name: 1 } },
      ])
      .exec();
    return rows;
  }

  /**
   * Distinct active categories that have at least one ACTIVE product for this vendor.
   * Same source as storefront category tabs; exposed for clients that only need the tab list.
   */
  async getVendorProductCategories(
    vendorId: string,
  ): PromisifiedOperationFeedback<{
    categories: Array<{ id: string; name: string }>;
  }> {
    if (!Types.ObjectId.isValid(vendorId)) {
      return this.Result(
        true,
        "Invalid vendor id: must be a valid MongoDB ObjectId",
        undefined,
        400,
      );
    }
    try {
      const categories = await this.getStoreCategoryTabsForVendor(vendorId);
      return this.Result(false, "Vendor product categories retrieved", {
        categories,
      });
    } catch (error: any) {
      this.logger.error(`getVendorProductCategories: ${error?.message}`);
      return this.Result(
        true,
        "Failed to load vendor product categories",
        undefined,
        500,
      );
    }
  }

  async findByVendorId(
    vendorId: string,
    options: PaginationOptions & {
      categoryId?: string;
      activeOnly?: boolean;
    } = { page: 1, limit: 10 },
    userId?: string,
  ): PromisifiedOperationFeedback<PaginatedResponse<IProduct>> {
    try {
      const { page = 1, limit = 10 } = options;
      const limitNum = Math.max(1, Number(limit) || 10);

      if (!Types.ObjectId.isValid(vendorId)) {
        return this.Result(
          true,
          "Invalid vendor id: must be a valid MongoDB ObjectId",
          undefined,
          400,
        );
      }

      const rawCategoryId = options.categoryId?.trim();
      if (rawCategoryId && !Types.ObjectId.isValid(rawCategoryId)) {
        return this.Result(
          true,
          "Invalid categoryId: must be a valid MongoDB ObjectId",
          undefined,
          400,
        );
      }

      const filter: FilterQuery<ProductDocument> = {
        vendorId: this.utilsService.objectIdFromString(vendorId),
      };
      if (options.activeOnly) {
        filter.status = ProductStatus.ACTIVE;
      }
      if (rawCategoryId) {
        filter.categoryId =
          this.utilsService.objectIdFromString(rawCategoryId);
      }
      const [result, total] = await Promise.all([
        this.productsRepository.aggregate<IProduct>(
          filter,
          [
            ...this.vendorLookupStages,
            ...this.productCategorySubcategoryEnrichmentStages,
            ...this.getFavouriteLookupStages(userId),
            { $sort: { createdAt: -1 } },
          ],
          {},
          { page, itemsPerPage: limitNum },
        ),
        this.productsRepository.count(filter),
      ]);

      const totalNum = Number(total);
      const totalPages = Math.max(1, Math.ceil(totalNum / limitNum));

      const enriched = result.items.map(enrichProductWithFinalPrice) as IProduct[];
      const items = await this.mergeLatestReviewsIntoProducts(enriched, userId);

      return this.Result(false, "Vendor products retrieved successfully", {
        items,
        meta: {
          total: totalNum,
          page: Number(page),
          limit: limitNum,
          totalPages,
        },
      });
    } catch (error: any) {
      this.logger.error(`Error finding vendor products: ${error.message}`);
      return this.Result(
        true,
        "Failed to retrieve vendor products",
        undefined,
        500,
      );
    }
  }

  async update(
    id: string,
    vendorId: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductDocument> {
    try {
      // Find the product and verify ownership
      const product = await this.findById(id);
      if (product.vendorId.toString() !== vendorId) {
        throw new NotFoundException("Product not found");
      }

      // If category is being updated, verify it exists
      if (updateProductDto.categoryId) {
        const categoryCheck = await this.categoriesService.findById(
          updateProductDto.categoryId,
        );
        if (categoryCheck.failed) {
          throw new NotFoundException(
            categoryCheck.description ?? "Category not found",
          );
        }
      }

      // Handle image updates
      if (updateProductDto.images) {
        // Find images that were removed
        const removedImages = product.images.filter(
          (img) => !updateProductDto.images.includes(img),
        );

        // Find new images that were added
        const newImages = updateProductDto.images.filter(
          (img) => !product.images.includes(img),
        );

        // Mark removed images as unused
        if (removedImages.length > 0) {
          for (const imageUrl of removedImages) {
            // Find the file record to get the publicId
            const fileRecord = await this.fileUploadsRepository.query({
              url: imageUrl,
              userId: vendorId,
            });
            if (fileRecord) {
              await this.filesService.markFileAsUnused(
                fileRecord.publicId,
                vendorId,
              );
            }
          }
        }

        // Mark new images as in use
        if (newImages.length > 0) {
          for (const imageUrl of newImages) {
            // Find the file record to get the publicId
            const fileRecord = await this.fileUploadsRepository.query({
              url: imageUrl,
              userId: vendorId,
            });
            if (fileRecord) {
              await this.filesService.markFileAsInUse(
                fileRecord.publicId,
                vendorId,
              );
            }
          }
        }
      }

      const {
        attributes: patchAttributes,
        quantity,
        expectedQuantity,
        variations,
        ...updateRest
      } = updateProductDto;

      if (Array.isArray(variations)) {
        variations.forEach((vari) => {
          if (vari.attributes && typeof vari.attributes.color === "string") {
            vari.attributes.color = vari.attributes.color.toLowerCase();
          }
        });
      }

      const attributes =
        patchAttributes !== undefined
          ? this.normalizeAttributeRecord(patchAttributes)
          : undefined;

      const stockEdit: ProductStockEdit = {
        quantity,
        expectedQuantity,
        variations,
        defaultVariationChanges: {
          name: updateProductDto.name,
          price: updateProductDto.amount,
          attributes,
        },
        defaultVariationBase: {
          name: updateProductDto.name ?? product.name,
          price: updateProductDto.amount ?? product.amount,
          attributes:
            attributes ??
            this.normalizeAttributeRecord(product.defaultVariation?.attributes),
        },
      };

      const updatedProduct = await this.applyVendorEdit(
        id,
        vendorId,
        updateRest,
        stockEdit,
      );
      if (!updatedProduct) {
        throw new NotFoundException("Product not found");
      }

      return this.findById(id);
    } catch (error) {
      this.logger.error(`Error updating product: ${error.message}`);
      throw error;
    }
  }

  /**
   * Writes a vendor's edit without undoing what orders did to stock while it
   * was being made. Stock is written only where the vendor changed it and
   * only while it is still what the vendor saw; the write is conditional on
   * the stock it was planned from, and is planned again if an order moved
   * stock in between. A vendor's change to stock that orders have since moved
   * is refused with the current figure, for the vendor to review.
   */
  private async applyVendorEdit(
    id: string,
    vendorId: string,
    fields: Record<string, unknown>,
    stockEdit: ProductStockEdit,
  ): Promise<ProductDocument | null> {
    const productId = this.utilsService.objectIdFromString(id);
    const ownerId = this.utilsService.objectIdFromString(vendorId);

    for (let attempt = 0; attempt < PRODUCT_EDIT_MAX_ATTEMPTS; attempt++) {
      const snapshot = await this.productsRepository.findVendorStockSnapshot(
        productId,
        ownerId,
      );
      if (!snapshot) {
        return null;
      }

      const plan = planProductStockEdit(snapshot, stockEdit);
      if (plan.kind === "invalid") {
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: plan.message,
          code: "EXPECTED_QUANTITY_REQUIRED",
        });
      }
      if (plan.kind === "conflict") {
        throw new ConflictException({
          statusCode: HttpStatus.CONFLICT,
          message: this.describeStockConflicts(plan.conflicts),
          code: "STOCK_CHANGED",
          conflicts: plan.conflicts,
        });
      }

      const updated = await this.productsRepository.applyVendorEdit(
        productId,
        ownerId,
        plan.guard,
        { set: { ...fields, ...plan.set }, unset: plan.unset },
      );
      if (updated) {
        return updated;
      }
      // An order moved stock between the read and the write: plan again.
    }

    throw new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      message:
        "Orders are changing this product's stock right now. Please try again in a moment.",
      code: "STOCK_BUSY",
    });
  }

  private describeStockConflicts(conflicts: StockConflict[]): string {
    const details = conflicts
      .map(
        (conflict) =>
          `${conflict.name ? `"${conflict.name}": ` : ""}${conflict.expectedQuantity} when you opened it, ${conflict.currentQuantity} now`,
      )
      .join("; ");
    return `Stock changed while you were editing, as orders came in (${details}). Review the stock and save again.`;
  }

  async findFeatured(userId?: string): Promise<IProduct[]> {
    try {
      const result = await this.productsRepository.aggregate<ProductDocument>(
        { status: ProductStatus.ACTIVE, isFeatured: true },
        [
          ...this.vendorLookupStages,
          ...this.productCategorySubcategoryEnrichmentStages,
          ...this.getFavouriteLookupStages(userId),
          { $sort: { rating: -1, totalRatings: -1 } },
          { $limit: 20 },
        ],
      );
      const enriched = result.items.map(enrichProductWithFinalPrice);
      return this.mergeLatestReviewsIntoProducts(enriched, userId);
    } catch (error) {
      this.logger.error(`Error finding featured products: ${error.message}`);
      throw error;
    }
  }

  async findDeals(userId?: string): Promise<IProduct[]> {
    try {
      // Get random products with low prices (up to 6 items)
      const result = await this.productsRepository.aggregate<ProductDocument>(
        {
          status: ProductStatus.ACTIVE,
          // Only include products with price less than 1000
          amount: { $lt: 1000 },
        },
        [
          // Sort by price ascending to get lowest prices
          { $sort: { amount: 1 } },
          // Get more items than needed for randomization
          { $limit: 1000 },
          // Randomize the results
          { $sample: { size: 6 } },
          ...this.vendorLookupStages,
          ...this.productCategorySubcategoryEnrichmentStages,
          ...this.getFavouriteLookupStages(userId),
        ],
      );
      const enriched = result.items.map(enrichProductWithFinalPrice);
      return this.mergeLatestReviewsIntoProducts(enriched, userId);
    } catch (error) {
      this.logger.error(`Error finding deals: ${error.message}`);
      throw error;
    }
  }

  async search(
    searchQuery: any,
    options: PaginationOptions = { page: 1, limit: 10 },
    userId?: string,
  ): Promise<PaginatedResponse<IProduct>> {
    try {
      const { page = 1, limit = 10 } = options;

      const query = {
        status: ProductStatus.ACTIVE,
        $or: [
          { name: searchQuery },
          { description: searchQuery },
          { brand: searchQuery },
          { category: searchQuery },
        ],
      };

      const [result, total] = await Promise.all([
        this.productsRepository.aggregate<ProductDocument>(
          query,
          [
            ...this.vendorLookupStages,
            ...this.productCategorySubcategoryEnrichmentStages,
            { $sort: { createdAt: -1 } },
          ],
          {},
          { page, itemsPerPage: limit },
        ),
        this.productsRepository.count(query),
      ]);

      const enriched = result.items.map(enrichProductWithFinalPrice);
      const items = await this.mergeLatestReviewsIntoProducts(enriched, userId);
      return {
        items,
        meta: {
          total: Number(total),
          page: Number(page),
          limit: Number(limit),
          totalPages: Number(result.totalPages),
        },
      };
    } catch (error) {
      this.logger.error(`Error searching products: ${error.message}`);
      throw error;
    }
  }

  async findByCategory(
    categoryId: string,
    options: PaginationOptions = { page: 1, limit: 10 },
    userId?: string,
  ): Promise<PaginatedResponse<IProduct>> {
    try {
      const { page = 1, limit = 10 } = options;

      const query = {
        status: ProductStatus.ACTIVE,
        categoryId: this.utilsService.objectIdFromString(categoryId),
      };

      const [result, total] = await Promise.all([
        this.productsRepository.aggregate<ProductDocument>(
          query,
          [
            ...this.vendorLookupStages,
            ...this.productCategorySubcategoryEnrichmentStages,
            ...this.getFavouriteLookupStages(userId),
            { $sort: { createdAt: -1 } },
          ],
          {},
          { page, itemsPerPage: limit },
        ),
        this.productsRepository.count(query),
      ]);

      const enriched = result.items.map(enrichProductWithFinalPrice);
      const items = await this.mergeLatestReviewsIntoProducts(enriched, userId);
      return {
        items,
        meta: {
          total: Number(total),
          page: Number(page),
          limit: Number(limit),
          totalPages: Number(result.totalPages),
        },
      };
    } catch (error) {
      this.logger.error(`Error finding products by category: ${error.message}`);
      throw error;
    }
  }

  async findBySubcategory(
    subcategoryId: string,
    options: PaginationOptions = { page: 1, limit: 10 },
    userId?: string,
  ): Promise<PaginatedResponse<IProduct>> {
    try {
      const { page = 1, limit = 10 } = options;

      const query = {
        status: ProductStatus.ACTIVE,
        subcategoryId: this.utilsService.objectIdFromString(subcategoryId),
      };

      const [result, total] = await Promise.all([
        this.productsRepository.aggregate<ProductDocument>(
          query,
          [
            ...this.vendorLookupStages,
            ...this.productCategorySubcategoryEnrichmentStages,
            ...this.getFavouriteLookupStages(userId),
            { $sort: { createdAt: -1 } },
          ],
          {},
          { page, itemsPerPage: limit },
        ),
        this.productsRepository.count(query),
      ]);

      const enriched = result.items.map(enrichProductWithFinalPrice);
      const items = await this.mergeLatestReviewsIntoProducts(enriched, userId);
      return {
        items,
        meta: {
          total: Number(total),
          page: Number(page),
          limit: Number(limit),
          totalPages: Number(result.totalPages),
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Error finding products by subcategory: ${error?.message}`,
      );
      throw error;
    }
  }

  async findBrands(searchQuery?: string): Promise<string[]> {
    try {
      const query: BrandQuery = {
        isActive: true,
        brand: { $exists: true, $ne: "" },
      };

      if (searchQuery) {
        query.brand = {
          ...query.brand,
          $regex: searchQuery,
          $options: "i",
        };
      }

      const result = await this.productsRepository.aggregate<ProductDocument>(
        query as FilterQuery<ProductDocument>,
        [{ $group: { _id: "$brand" } }, { $sort: { _id: 1 } }],
      );

      return result.items.map((item: any) => item._id);
    } catch (error) {
      this.logger.error(`Error finding brands: ${error.message}`);
      throw error;
    }
  }

  async getPriceRange(): Promise<{ minPrice: number; maxPrice: number }> {
    try {
      const result = await this.productsRepository.aggregate<PriceRangeResult>(
        { isActive: true },
        [
          {
            $group: {
              _id: null,
              minPrice: { $min: "$price" },
              maxPrice: { $max: "$price" },
            },
          },
        ],
      );

      if (!result.items.length) {
        return { minPrice: 0, maxPrice: 0 };
      }

      const { minPrice, maxPrice } = result.items[0];
      return { minPrice, maxPrice };
    } catch (error) {
      this.logger.error(`Error getting price range: ${error.message}`);
      throw error;
    }
  }

  async findWithFilters(
    filters: {
      brandIds?: string[];
      categoryIds?: string[];
      priceRange?: { minPrice: number; maxPrice: number };
    },
    options: PaginationOptions = { page: 1, limit: 10 },
    userId?: string,
  ): Promise<PaginatedResponse<IProduct>> {
    try {
      const { page = 1, limit = 10 } = options;
      const { brandIds, categoryIds, priceRange } = filters;

      const query: any = { isActive: true };

      if (brandIds?.length) {
        query.brand = { $in: brandIds };
      }

      if (categoryIds?.length) {
        query.category = { $in: categoryIds };
      }

      if (priceRange) {
        query.price = {
          $gte: priceRange.minPrice,
          $lte: priceRange.maxPrice,
        };
      }

      const [result, total] = await Promise.all([
        this.productsRepository.aggregate<ProductDocument>(
          query,
          [
            ...this.vendorLookupStages,
            ...this.productCategorySubcategoryEnrichmentStages,
            ...this.getFavouriteLookupStages(userId),
            { $sort: { rating: -1, totalRatings: -1 } },
          ],
          {},
          { page, itemsPerPage: limit },
        ),
        this.productsRepository.count(query),
      ]);

      const enriched = result.items.map(enrichProductWithFinalPrice);
      const items = await this.mergeLatestReviewsIntoProducts(enriched, userId);
      return {
        items,
        meta: {
          total: Number(total),
          page: Number(page),
          limit: Number(limit),
          totalPages: Number(result.totalPages),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error finding products with filters: ${error.message}`,
      );
      throw error;
    }
  }

  async saveProductAsFavorite(
    userId: string,
    productId: string,
  ): PromisifiedOperationFeedback<void> {
    const product = await this.findById(productId, undefined, {
      attachLatestReview: false,
    });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      return this.Result(true, "Product not found or not active");
    }

    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectProductId = this.utilsService.objectIdFromString(productId);

    const existingFavorite = await this.usersFavouriteProductRepository.query({
      userId: objectUserId,
      productId: objectProductId,
    });

    if (existingFavorite) {
      if (!existingFavorite.isActive) {
        await this.usersFavouriteProductRepository.updateOne(
          { _id: existingFavorite._id },
          { isActive: true },
        );
        return this.Result(false, "Product saved as favorite successfully");
      }

      return this.Result(true, "Product already saved as favorite");
    }

    await this.usersFavouriteProductRepository.create({
      userId: objectUserId,
      productId: objectProductId,
      isActive: true,
    });

    return this.Result(false, "Product saved as favorite successfully");
  }

  async removeProductAsFavorite(
    userId: string,
    productId: string,
  ): PromisifiedOperationFeedback<void> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectProductId = this.utilsService.objectIdFromString(productId);

    const deleted = await this.usersFavouriteProductRepository.delete({
      userId: objectUserId,
      productId: objectProductId,
    });

    if (!deleted) {
      return this.Result(true, "Product is not in your favorites");
    }

    return this.Result(false, "Product removed from favorites successfully");
  }

  async getUserSavedProducts(
    userId: string,
    paginationQuery: IPaginationQuery = { page: 1, itemsPerPage: 10 },
  ): PromisifiedOperationFeedback<
    PaginatedResponse<
      IProduct & { latestReview: ProductReviewListItem | null }
    >
  > {
    try {
      const objectUserId = this.utilsService.objectIdFromString(userId);
      const pageNum = Math.max(1, Number(paginationQuery?.page) || 1);
      const limitNum = Math.max(1, Number(paginationQuery?.itemsPerPage) || 10);

      const favouriteMatch = { userId: objectUserId, isActive: true };
      const pipelineAfterActiveProduct: PipelineStage[] = [
        {
          $lookup: {
            from: DBCollectionNames.PRODUCTS,
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $match: {
            "product.status": ProductStatus.ACTIVE,
          },
        },
      ];

      const afterProductAsRoot: PipelineStage[] = [
        { $replaceRoot: { newRoot: "$product" } },
        ...this.vendorLookupStages,
        ...this.productCategorySubcategoryEnrichmentStages,
        { $addFields: { isFavourite: true } },
        { $sort: { createdAt: -1 } },
      ];

      const [countRows, result] = await Promise.all([
        this.usersFavouriteProductRepository.model.aggregate<{ total: number }>(
          [
            { $match: favouriteMatch },
            ...pipelineAfterActiveProduct,
            { $count: "total" },
          ],
        ),
        this.usersFavouriteProductRepository.aggregate<any>(
          favouriteMatch,
          [...pipelineAfterActiveProduct, ...afterProductAsRoot],
          {},
          { page: pageNum, itemsPerPage: limitNum },
        ),
      ]);

      const totalNum = Number(countRows[0]?.total ?? 0);
      const totalPages = Math.max(1, Math.ceil(totalNum / limitNum));

      const enriched = (result?.items || []).map(enrichProductWithFinalPrice);
      const items = await this.mergeLatestReviewsIntoProducts(enriched, userId);

      const response: PaginatedResponse<
        IProduct & { latestReview: ProductReviewListItem | null }
      > = {
        items,
        meta: {
          total: totalNum,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
      };

      return this.Result(
        false,
        "Saved products retrieved successfully",
        response,
      );
    } catch (error: any) {
      this.logger.error(
        `Error retrieving saved products: ${error?.message}`,
        error?.stack,
      );
      return this.Result(
        true,
        "Failed to retrieve saved products",
        undefined,
        500,
      );
    }
  }

  /**
   * Saved products organised by the store that sells them. Because a cart holds
   * one store at a time, the shopper needs to see and act on their saved items
   * store by store rather than as one undifferentiated list.
   *
   * Unpaginated: the grouping is only meaningful over the whole set, and a saved
   * list is bounded by what one shopper has deliberately kept.
   */
  async getUserSavedProductsGroupedByStore(
    userId: string,
  ): PromisifiedOperationFeedback<SavedProductsByStore[]> {
    try {
      const objectUserId = this.utilsService.objectIdFromString(userId);

      const rows = await this.usersFavouriteProductRepository.model.aggregate<{
        _id: unknown;
        vendor?: Record<string, unknown>;
        products: IProduct[];
      }>([
        { $match: { userId: objectUserId, isActive: true } },
        // Most recently saved first, preserved through $group's $push.
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: DBCollectionNames.PRODUCTS,
            localField: "productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: "$product" },
        { $match: { "product.status": ProductStatus.ACTIVE } },
        { $replaceRoot: { newRoot: "$product" } },
        ...this.vendorLookupStages,
        ...this.productCategorySubcategoryEnrichmentStages,
        { $addFields: { isFavourite: true } },
        {
          $group: {
            _id: "$vendorId",
            vendor: { $first: "$vendor" },
            products: { $push: "$$ROOT" },
          },
        },
        { $sort: { "vendor.businessName": 1 } },
      ]);

      const groups: SavedProductsByStore[] = rows.map((row) => ({
        vendor: {
          _id: String(row._id ?? ""),
          ...(row.vendor ?? {}),
        } as SavedProductsByStore["vendor"],
        productCount: row.products.length,
        products: row.products.map(enrichProductWithFinalPrice) as IProduct[],
      }));

      return this.Result(
        false,
        "Saved products grouped by store retrieved successfully",
        groups,
      );
    } catch (error: any) {
      this.logger.error(
        `Error retrieving grouped saved products: ${error?.message}`,
        error?.stack,
      );
      return this.Result(
        true,
        "Failed to retrieve saved products",
        undefined,
        500,
      );
    }
  }
}
