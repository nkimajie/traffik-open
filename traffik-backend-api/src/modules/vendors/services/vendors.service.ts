import { Injectable, HttpException, HttpStatus, Logger, Inject, forwardRef } from "@nestjs/common";
import { VendorsRepository } from "../repositories/vendors.repository";
import { VendorDocument } from "../schemas/vendor.schema";
import { CompleteVendorSignupDto } from "../dto/complete-vendor-signup.dto";
import { FilesService } from "../../files/services/files.service";
import { FileUploadsRepository } from "../../files/repositories/file-uploads.repository";
import { PaginationOptions } from "src/common/interfaces/pagination-options.interface";
import { PaginatedResponse } from "src/common/interfaces/paginated-response.interface";
import { IPublicVendor, IVendor } from "../interfaces/vendors.interface";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { UsersFavouriteStoreRepository } from "src/modules/shared/repositories/users-favourite-store.repository";
import { BaseService } from "src/modules/shared/base/service.base";
import { PromisifiedOperationFeedback } from "src/modules/shared/types/promisified_operation_feedback.type";
import { DBCollectionNames } from "src/modules/shared/enums/db_collections_name.enum";
import type { PipelineStage } from "mongoose";
import { IPaginationQuery } from "src/modules/shared/interfaces/pagination_query.interface";
import { ProductsService } from "src/modules/products/services/products.service";
import { VendorLikesService } from "./vendor-likes.service";
import { UserRole } from "src/modules/users/enums/user-role.enum";
import { VendorLikesRepository } from "../repositories/vendor-likes.repository";
import { VendorKycRepository } from "../repositories/vendor-kyc.repository";
import {
  SubmitVendorKycDto,
  UpdateKycStatusDto,
} from "../dto/submit-vendor-kyc.dto";
import { KycStatus } from "../enums/vendor-kyc.enum";
import { VendorKycDocument } from "../schemas/vendor-kyc.schema";
import { OrdersRepository } from "../../orders/repositories/orders.repository";
import { UsersFavouriteProductRepository } from "../../shared/repositories/users-favourite-product.repository";
import { ProductsRepository } from "../../products/repositories/products.repository";
import {
  DashboardDuration,
  VendorDashboardResponseDto,
} from "../dto/vendor-dashboard.dto";
import {
  ProductSortOption,
  ProductStatusFilter,
  VendorProductsResponseDto,
} from "../dto/vendor-products.dto";
import { OrderStatus } from "../../orders/enums/order.enum";
import { ProductStatus } from "../../products/enums/product-status.enum";
import { AdminStoresResponseDto } from "../dto/admin-stores.dto";
import { EmailService } from "../../shared/services/email/email.service";
import { EmailTemplate } from "../../shared/services/email/enums/email_template.enum";
import {
  getAppWebUrl,
  getSupportEmail,
} from "../../shared/services/email/email.helpers";
import { CategoriesRepository } from "../../categories/repositories/categories.repository";
import { OrdersService } from "../../orders/services/orders.service";
import { KashiaService } from "../../escrow/services/kashia.service";
import { PRIVATE_VENDOR_FIELDS } from "../constants/vendor-private-fields.constant";
import { PublicVendorStorefrontQuery } from "../interfaces/public-vendor-storefront-query.interface";

@Injectable()
export class VendorsService extends BaseService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    private readonly vendorsRepository: VendorsRepository,
    private readonly filesService: FilesService,
    private readonly fileUploadsRepository: FileUploadsRepository,
    private readonly utilsService: UtilsService,
    private readonly usersFavouriteStoreRepository: UsersFavouriteStoreRepository,
    private readonly productsService: ProductsService,
    private readonly vendorLikesService: VendorLikesService,
    private readonly vendorLikesRepository: VendorLikesRepository,
    private readonly vendorKycRepository: VendorKycRepository,
    private readonly ordersRepository: OrdersRepository,
    private readonly usersFavouriteProductRepository: UsersFavouriteProductRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly emailService: EmailService,
    private readonly categoriesRepository: CategoriesRepository,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    private readonly kashiaService: KashiaService,
  ) {
    super();
  }

  formatVendorData(vendor: VendorDocument | Record<string, unknown>) {
    const raw =
      typeof (vendor as VendorDocument)?.toObject === "function"
        ? (vendor as VendorDocument).toObject()
        : { ...(vendor as Record<string, unknown>) };
    // Drop password and legacy review fields if still present in DB documents.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {
      password,
      rating: _legacyR,
      totalRatings: _legacyTr,
      ...rest
    } = raw as Record<string, unknown>;
    const totalLikes =
      typeof rest.totalLikes === "number"
        ? rest.totalLikes
        : Number(rest.totalLikes) || 0;
    const isApproved = !!rest.isApproved;

    return { ...rest, totalLikes, isApproved } as Omit<IVendor, "isLiked"> &
      Record<string, unknown>;
  }

  /**
   * {@link formatVendorData} minus the owner's private account fields. Use for
   * any store shown to shoppers or the public; the full format is for the
   * vendor's own profile and auth responses.
   */
  formatPublicVendorData(vendor: VendorDocument | Record<string, unknown>) {
    const data = this.formatVendorData(vendor) as Record<string, unknown>;
    for (const field of PRIVATE_VENDOR_FIELDS) {
      delete data[field];
    }
    return data as IPublicVendor & Record<string, unknown>;
  }

  private async enrichVendorsWithCategories<
    T extends Record<string, unknown>,
  >(vendors: T[]): Promise<T[]> {
    const categoryIds = new Set<string>();

    for (const vendor of vendors) {
      const ids = vendor.businessCategories as unknown[] | undefined;
      if (!Array.isArray(ids)) continue;
      for (const entry of ids) {
        if (typeof entry === "string") {
          categoryIds.add(entry);
        } else if (
          entry &&
          typeof entry === "object" &&
          "_id" in (entry as object)
        ) {
          categoryIds.add(String((entry as { _id: unknown })._id));
        }
      }
    }

    if (categoryIds.size === 0) {
      return vendors;
    }

    const categoryResult = await this.categoriesRepository.queryAll(
      {
        _id: {
          $in: [...categoryIds].map((id) =>
            this.utilsService.objectIdFromString(id),
          ),
        },
        isActive: true,
      },
      undefined,
      { page: 1, itemsPerPage: Math.max(categoryIds.size, 1) },
    );
    const categories = categoryResult.items ?? [];

    const byId = new Map(
      categories.map((category) => [
        String(category._id),
        { _id: String(category._id), name: category.name },
      ]),
    );

    return vendors.map((vendor) => {
      const raw = vendor.businessCategories as unknown[] | undefined;
      if (!Array.isArray(raw) || raw.length === 0) {
        return vendor;
      }

      const populated = raw
        .map((entry) => {
          if (entry && typeof entry === "object" && "name" in (entry as object)) {
            const doc = entry as { _id: unknown; name: string };
            return { _id: String(doc._id), name: doc.name };
          }
          const id = String(entry);
          return byId.get(id);
        })
        .filter(
          (entry): entry is { _id: string; name: string } => entry != null,
        );

      return populated.length
        ? ({ ...vendor, businessCategories: populated } as T)
        : vendor;
    });
  }

  private buyerViewerId(userId?: string, role?: string): string | undefined {
    if (!userId?.trim() || !role?.trim()) {
      return undefined;
    }
    if (role.toUpperCase() !== UserRole.USER.toUpperCase()) {
      return undefined;
    }
    return userId;
  }

  private async mergeVendorLikeFlags<
    T extends Record<string, unknown> & { _id?: unknown },
  >(
    rows: T[],
    viewerUserId?: string,
    viewerRole?: string,
  ): Promise<Array<T & { totalLikes: number; isLiked: boolean }>> {
    const buyerId = this.buyerViewerId(viewerUserId, viewerRole);
    const ids = rows.map((r) => String(r._id));
    const liked = buyerId
      ? await this.vendorLikesService.getLikedVendorIdSet(buyerId, ids)
      : new Set<string>();
    return rows.map((r) => ({
      ...r,
      totalLikes: Number((r as { totalLikes?: number }).totalLikes ?? 0),
      isLiked: buyerId ? liked.has(String(r._id)) : false,
    }));
  }

  async toggleVendorLike(
    userId: string,
    vendorId: string,
  ): PromisifiedOperationFeedback<{
    isLiked: boolean;
    totalLikes: number;
  }> {
    return this.vendorLikesService.toggleLike(vendorId, userId);
  }

  /**
   * Public storefront: vendor profile, category tabs (from active products), and paginated active products.
   * `totalLikes` / `isLiked` (buyers only, when JWT present) reflect store likes.
   */
  async getPublicVendorById(
    vendorId: string,
    query: PublicVendorStorefrontQuery = {},
    viewerUserId?: string,
    viewerRole?: string,
  ): PromisifiedOperationFeedback<Record<string, unknown>> {
    const vendor = await this.findById(vendorId);
    if (!vendor || !vendor.isActive || !vendor.isSignupCompleted) {
      return this.Result(true, "Vendor not found", undefined, 404);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const categoryId = query.categoryId?.trim();

    const [categories, productsResult] = await Promise.all([
      this.productsService.getStoreCategoryTabsForVendor(vendorId),
      this.productsService.findByVendorId(
        vendorId,
        {
          page,
          limit,
          activeOnly: true,
          ...(categoryId ? { categoryId } : {}),
        },
        viewerUserId,
      ),
    ]);

    if (productsResult.failed) {
      return this.Result(
        true,
        productsResult.description,
        undefined,
        productsResult.code ?? 500,
      );
    }

    const base = this.formatPublicVendorData(vendor) as Record<string, unknown>;
    const [enrichedBase] = await this.enrichVendorsWithCategories([base]);
    const buyerId = this.buyerViewerId(viewerUserId, viewerRole);
    const isLiked = buyerId
      ? await this.vendorLikesService.isLikedByUser(vendorId, buyerId)
      : false;

    return this.Result(false, "Vendor retrieved successfully", {
      ...enrichedBase,
      isLiked,
      productCategories: categories,
      products: productsResult.data,
    });
  }

  async findByEmail(email: string): Promise<VendorDocument | null> {
    return this.vendorsRepository.query({ email });
  }

  async findById(id: string): Promise<VendorDocument | null> {
    const vendor = await this.vendorsRepository.query({ _id: id });
    return vendor;
  }

  async updateLastLogin(id: string): Promise<VendorDocument | null> {
    return this.vendorsRepository.updateOne(
      { _id: id },
      { lastLoginAt: new Date() },
    );
  }

  async create(data: Partial<VendorDocument>): Promise<VendorDocument> {
    const vendor = await this.vendorsRepository.create(data);
    return vendor;
  }

  async update(
    id: string,
    data: Partial<VendorDocument>,
  ): Promise<VendorDocument | null> {
    const vendor = await this.vendorsRepository.updateOne({ _id: id }, data);
    return vendor;
  }

  async delete(id: string): Promise<VendorDocument | null> {
    const vendor = await this.vendorsRepository.delete({ _id: id });
    return vendor;
  }

  async completeSignup(
    id: string,
    completeSignupDto: CompleteVendorSignupDto,
  ): Promise<VendorDocument> {
    const vendor = await this.findById(id);
    if (!vendor) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: "Vendor not found",
          code: "VENDOR_NOT_FOUND",
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (vendor.isSignupCompleted) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: "Vendor signup already completed",
          code: "SIGNUP_ALREADY_COMPLETED",
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const categoryIds = completeSignupDto.businessCategories ?? [];
    const categoriesResult = await this.categoriesRepository.queryAll(
      {
        _id: {
          $in: categoryIds.map((id) => this.utilsService.objectIdFromString(id)),
        },
        isActive: true,
      },
      undefined,
      { page: 1, itemsPerPage: Math.max(categoryIds.length, 1) },
    );
    const categories = categoriesResult.items ?? [];

    if (categories.length !== categoryIds.length) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: "One or more business categories are invalid",
          code: "INVALID_BUSINESS_CATEGORIES",
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const primaryCategoryName = categories[0]?.name ?? "";

    // Handle store logo
    if (completeSignupDto.storeLogo?.trim()) {
      const logoFile = await this.fileUploadsRepository.query({
        url: completeSignupDto.storeLogo,
        userId: id,
      });
      if (logoFile) {
        await this.filesService.markFileAsInUse(logoFile.publicId, id);
      }
    }

    // Handle store cover photo
    if (completeSignupDto.storeCoverPhoto?.trim()) {
      const coverFile = await this.fileUploadsRepository.query({
        url: completeSignupDto.storeCoverPhoto,
        userId: id,
      });
      if (coverFile) {
        await this.filesService.markFileAsInUse(coverFile.publicId, id);
      }
    }

    const {
      businessCategory: _legacyCategory,
      storeLogo,
      storeCoverPhoto,
      ...signupFields
    } = completeSignupDto;

    const updatedVendor = await this.vendorsRepository.updateOne(
      { _id: id },
      {
        ...signupFields,
        businessCategories: categoryIds,
        businessCategory: primaryCategoryName,
        storeLogo: storeLogo?.trim() || null,
        storeCoverPhoto: storeCoverPhoto?.trim() || null,
        isSignupCompleted: true,
      },
    );

    if (!updatedVendor) {
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to update vendor",
          code: "VENDOR_UPDATE_FAILED",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return updatedVendor.toObject();
  }

  async saveStoreAsFavorite(
    userId: string,
    vendorId: string,
  ): PromisifiedOperationFeedback<void> {
    const vendor = await this.findById(vendorId);
    if (!vendor || !vendor.isActive || !vendor.isSignupCompleted) {
      return this.Result(true, "Store not found or not active");
    }

    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectVendorId = this.utilsService.objectIdFromString(vendorId);

    const existingFavorite = await this.usersFavouriteStoreRepository.query({
      userId: objectUserId,
      vendorId: objectVendorId,
    });

    if (existingFavorite) {
      if (!existingFavorite.isActive) {
        await this.usersFavouriteStoreRepository.updateOne(
          { _id: existingFavorite._id },
          { isActive: true },
        );
        return this.Result(false, "Store saved as favorite successfully");
      }

      return this.Result(true, "Store already saved as favorite");
    }

    await this.usersFavouriteStoreRepository.create({
      userId: objectUserId,
      vendorId: objectVendorId,
      isActive: true,
    });

    return this.Result(false, "Store saved as favorite successfully");
  }

  async removeStoreAsFavorite(
    userId: string,
    vendorId: string,
  ): PromisifiedOperationFeedback<void> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectVendorId = this.utilsService.objectIdFromString(vendorId);

    const deleted = await this.usersFavouriteStoreRepository.delete({
      userId: objectUserId,
      vendorId: objectVendorId,
    });

    if (!deleted) {
      return this.Result(true, "Store is not in your favorites");
    }
    return this.Result(false, "Store removed from favorites successfully");
  }

  async getUserSavedStores(
    userId: string,
    paginationQuery: IPaginationQuery = { page: 1, itemsPerPage: 10 },
  ): PromisifiedOperationFeedback<PaginatedResponse<IVendor>> {
    try {
      const objectUserId = this.utilsService.objectIdFromString(userId);
      const page = Math.max(1, Number(paginationQuery.page) || 1);
      const limit = Math.max(1, Number(paginationQuery.itemsPerPage) || 10);

      const listPipeline: PipelineStage[] = [
        {
          $lookup: {
            from: DBCollectionNames.VENDORS,
            localField: "vendorId",
            foreignField: "_id",
            as: "vendor",
          },
        },
        { $unwind: "$vendor" },
        {
          $match: {
            "vendor.isActive": true,
          },
        },
        {
          $replaceRoot: { newRoot: "$vendor" },
        },
        { $sort: { createdAt: -1 } },
      ];

      const [totalRows, result] = await Promise.all([
        this.usersFavouriteStoreRepository.model
          .aggregate<{
            total: number;
          }>([
            { $match: { userId: objectUserId, isActive: true } },
            ...listPipeline,
            { $count: "total" },
          ])
          .exec(),
        this.usersFavouriteStoreRepository.aggregate<any>(
          { userId: objectUserId, isActive: true },
          listPipeline,
          {},
          { page, itemsPerPage: limit },
        ),
      ]);

      const totalNum = totalRows[0]?.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalNum / limit) || 1);

      const formatted = result.items.map((v) =>
        this.formatPublicVendorData(v),
      ) as Array<Record<string, unknown> & { _id: unknown }>;
      const vendors = (await this.mergeVendorLikeFlags(
        formatted,
        userId,
        UserRole.USER,
      )) as unknown as IVendor[];

      const response: PaginatedResponse<IVendor> = {
        items: vendors,
        meta: {
          total: totalNum,
          page,
          limit,
          totalPages,
        },
      };

      return this.Result(
        false,
        "Saved stores retrieved successfully",
        response,
      );
    } catch (error) {
      this.logger.error(`Error retrieving user saved stores: ${error.message}`);
      return this.Result(
        true,
        "Failed to retrieve saved stores",
        undefined,
        500,
      );
    }
  }
  async getLikedVendors(
    userId: string,
    paginationQuery: IPaginationQuery = { page: 1, itemsPerPage: 10 },
  ): PromisifiedOperationFeedback<PaginatedResponse<IVendor>> {
    try {
      const objectUserId = this.utilsService.objectIdFromString(userId);
      const page = Math.max(1, Number(paginationQuery.page) || 1);
      const limit = Math.max(1, Number(paginationQuery.itemsPerPage) || 10);

      const listPipeline: PipelineStage[] = [
        {
          $lookup: {
            from: DBCollectionNames.VENDORS,
            localField: "vendorId",
            foreignField: "_id",
            as: "vendor",
          },
        },
        { $unwind: "$vendor" },
        {
          $match: {
            "vendor.isActive": true,
            "vendor.isSignupCompleted": true,
          },
        },
        {
          $replaceRoot: { newRoot: "$vendor" },
        },
        { $sort: { createdAt: -1 } },
      ];

      const [totalRows, result] = await Promise.all([
        this.vendorLikesRepository.model
          .aggregate<{
            total: number;
          }>([
            { $match: { userId: objectUserId } },
            ...listPipeline,
            { $count: "total" },
          ])
          .exec(),
        this.vendorLikesRepository.aggregate<any>(
          { userId: objectUserId },
          listPipeline,
          {},
          { page, itemsPerPage: limit },
        ),
      ]);

      const totalNum = totalRows[0]?.total ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalNum / limit) || 1);

      const formatted = result.items.map((v) =>
        this.formatPublicVendorData(v),
      ) as Array<Record<string, unknown> & { _id: unknown }>;
      const vendors = (await this.mergeVendorLikeFlags(
        formatted,
        userId,
        UserRole.USER,
      )) as unknown as IVendor[];

      const response: PaginatedResponse<IVendor> = {
        items: vendors,
        meta: {
          total: totalNum,
          page,
          limit,
          totalPages,
        },
      };

      return this.Result(
        false,
        "Liked vendors retrieved successfully",
        response,
      );
    } catch (error) {
      this.logger.error(
        `Error retrieving user liked vendors: ${error.message}`,
      );
      return this.Result(
        true,
        "Failed to retrieve liked vendors",
        undefined,
        500,
      );
    }
  }

  async findAll(
    options: PaginationOptions & { sort?: any } = { page: 1, limit: 10 },
    viewerUserId?: string,
    viewerRole?: string,
  ): Promise<PaginatedResponse<IVendor>> {
    try {
      const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
      const query = { isActive: true, isSignupCompleted: true };

      const [result, total] = await Promise.all([
        this.vendorsRepository.aggregate<VendorDocument>(
          query,
          [{ $sort: sort }, { $project: { password: 0 } }],
          {},
          { page, itemsPerPage: limit },
        ),
        this.vendorsRepository.count(query),
      ]);

      const rows = result.items.map((v) =>
        this.formatPublicVendorData(v),
      ) as Array<Record<string, unknown> & { _id: unknown }>;
      const enrichedRows = await this.enrichVendorsWithCategories(rows);
      const items = (await this.mergeVendorLikeFlags(
        enrichedRows,
        viewerUserId,
        viewerRole,
      )) as unknown as IVendor[];

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
      this.logger.error(`Error finding vendors: ${error.message}`);
      throw error;
    }
  }

  async findForHome(
    viewerUserId?: string,
    viewerRole?: string,
  ): Promise<IVendor[]> {
    try {
      const result = await this.vendorsRepository.aggregate<VendorDocument>(
        { isActive: true, isSignupCompleted: true },
        [
          { $sort: { totalLikes: -1, createdAt: -1 } },
          { $limit: 20 }, // Limit to 20 vendors for home screen
          { $project: { password: 0 } }, // Exclude password
        ],
      );
      const items = result.items.map((v) =>
        this.formatPublicVendorData(v),
      ) as Array<Record<string, unknown> & { _id: unknown }>;
      const enrichedItems = await this.enrichVendorsWithCategories(items);
      return (await this.mergeVendorLikeFlags(
        enrichedItems,
        viewerUserId,
        viewerRole,
      )) as unknown as IVendor[];
    } catch (error) {
      this.logger.error(`Error finding home vendors: ${error.message}`);
      throw error;
    }
  }

  async search(
    searchQuery: any,
    options: PaginationOptions = { page: 1, limit: 10 },
    viewerUserId?: string,
    viewerRole?: string,
  ): Promise<PaginatedResponse<IVendor>> {
    try {
      const { page = 1, limit = 10 } = options;

      const query = {
        isActive: true,
        isSignupCompleted: true,
        $or: [
          { businessName: searchQuery },
          { description: searchQuery },
          { businessCategory: searchQuery },
        ],
      };

      const [result, total] = await Promise.all([
        this.vendorsRepository.aggregate<VendorDocument>(
          query,
          [
            { $sort: { totalLikes: -1, createdAt: -1 } },
            { $project: { password: 0 } }, // Exclude password
          ],
          {},
          { page, itemsPerPage: limit },
        ),
        this.vendorsRepository.count(query),
      ]);

      const rows = result.items.map((v) =>
        this.formatPublicVendorData(v),
      ) as Array<Record<string, unknown> & { _id: unknown }>;
      const enrichedRows = await this.enrichVendorsWithCategories(rows);
      const items = (await this.mergeVendorLikeFlags(
        enrichedRows,
        viewerUserId,
        viewerRole,
      )) as unknown as IVendor[];
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
      this.logger.error(`Error searching vendors: ${error.message}`);
      throw error;
    }
  }

  async getAllVendorsRandom(
    paginationQuery: IPaginationQuery = { page: 1, itemsPerPage: 10 },
    viewerUserId?: string,
    viewerRole?: string,
  ): PromisifiedOperationFeedback<PaginatedResponse<IVendor>> {
    const page = Math.max(1, Number(paginationQuery.page) || 1);
    const limit = Math.max(1, Number(paginationQuery.itemsPerPage) || 10);

    const [result, totalNum] = await Promise.all([
      this.vendorsRepository.aggregate<VendorDocument>(
        { isActive: true, isSignupCompleted: true },
        [
          { $addFields: { random: { $rand: {} } } },
          { $sort: { random: 1 } },
          { $project: { password: 0, random: 0 } },
        ],
        {},
        { page, itemsPerPage: limit },
      ),
      this.vendorsRepository.count({ isActive: true, isSignupCompleted: true }),
    ]);

    const formatted = (result?.items?.map((v) =>
      this.formatPublicVendorData(v),
    ) || []) as Array<Record<string, unknown> & { _id: unknown }>;
    const enrichedFormatted = await this.enrichVendorsWithCategories(formatted);
    const vendors = (await this.mergeVendorLikeFlags(
      enrichedFormatted,
      viewerUserId,
      viewerRole,
    )) as unknown as IVendor[];

    const total = Number(totalNum);
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

    const response: PaginatedResponse<IVendor> = {
      items: vendors,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };

    return this.Result(false, "Vendors retrieved successfully", response);
  }

  /** Up to 10 active stores with at least one like, ranked by totalLikes (descending). */
  async findTrendingVendors(
    viewerUserId?: string,
    viewerRole?: string,
  ): PromisifiedOperationFeedback<{ items: IVendor[] }> {
    try {
      const agg = await this.vendorsRepository.aggregate<VendorDocument>(
        { isActive: true, isSignupCompleted: true, totalLikes: { $gt: 0 } },
        [{ $sort: { totalLikes: -1, _id: 1 } }, { $project: { password: 0 } }],
        {},
        { page: 1, itemsPerPage: 10 },
      );
      const rows = (agg.items?.map((v) => this.formatPublicVendorData(v)) ||
        []) as Array<Record<string, unknown> & { _id: unknown }>;
      const enrichedRows = await this.enrichVendorsWithCategories(rows);
      const items = (await this.mergeVendorLikeFlags(
        enrichedRows,
        viewerUserId,
        viewerRole,
      )) as unknown as IVendor[];

      return this.Result(false, "Trending vendors retrieved", { items });
    } catch (error: any) {
      this.logger.error(`findTrendingVendors: ${error?.message}`);
      return this.Result(
        true,
        "Failed to load trending vendors",
        undefined,
        500,
      );
    }
  }

  async submitKyc(
    vendorId: string,
    dto: SubmitVendorKycDto,
  ): PromisifiedOperationFeedback<VendorKycDocument> {
    const existingKyc = await this.vendorKycRepository.query({
      vendor: vendorId,
      status: KycStatus.PENDING,
    });

    if (existingKyc) {
      return this.Result(true, "You have a pending KYC submission");
    }

    const kyc = await this.vendorKycRepository.create({
      ...dto,
      vendor: vendorId,
      status: KycStatus.PENDING,
    });

    return this.Result(false, "KYC submitted successfully", kyc);
  }

  async getAllKycs(
    paginationQuery: IPaginationQuery = { page: 1, itemsPerPage: 10 },
  ): PromisifiedOperationFeedback<PaginatedResponse<VendorKycDocument>> {
    const page = Math.max(1, Number(paginationQuery.page) || 1);
    const limit = Math.max(1, Number(paginationQuery.itemsPerPage) || 10);

    const [items, total] = await Promise.all([
      this.vendorKycRepository.model
        .find()
        .populate("vendor", "firstName lastName email businessName")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.vendorKycRepository.count({}),
    ]);

    const totalPages = Math.ceil(Number(total) / limit);

    return this.Result(false, "KYCs retrieved successfully", {
      items,
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages,
      },
    });
  }

  async updateKycStatus(
    kycId: string,
    dto: UpdateKycStatusDto,
  ): PromisifiedOperationFeedback<VendorKycDocument> {
    const kyc = await this.vendorKycRepository.query({ _id: kycId });
    if (!kyc) {
      return this.Result(true, "KYC record not found", undefined, 404);
    }

    const updatedKyc = await this.vendorKycRepository.updateOne(
      { _id: kycId },
      { status: dto.status as KycStatus, notes: dto.notes },
    );

    if (dto.status === KycStatus.APPROVED) {
      await this.vendorsRepository.updateOne(
        { _id: kyc.vendor },
        { isApproved: true },
      );
    } else if (dto.status === KycStatus.REJECTED) {
      await this.vendorsRepository.updateOne(
        { _id: kyc.vendor },
        { isApproved: false },
      );
    }

    void this.dispatchKycDecisionEmail(kyc.vendor, dto.status as KycStatus, dto.notes);

    if (dto.status === KycStatus.APPROVED && this.kashiaService.isConfigured()) {
      void this.kashiaService
        .getOrCreateVendorCustomer(String(kyc.vendor))
        .catch((error) => {
          this.logger.error(
            `Failed to register Kashia customer for KYC-approved vendor ${String(kyc.vendor)}`,
            error,
          );
        });
    }

    return this.Result(false, `KYC ${dto.status} successfully`, updatedKyc);
  }

  async updateVendorApproval(
    vendorId: string,
    dto: { status: "approved" | "rejected"; notes?: string },
  ): PromisifiedOperationFeedback<VendorDocument> {
    const vendor = await this.vendorsRepository.query({ _id: vendorId });
    if (!vendor) {
      return this.Result(true, "Vendor not found", undefined, 404);
    }

    const isApproved = dto.status === KycStatus.APPROVED;
    await this.vendorsRepository.updateOne({ _id: vendorId }, { isApproved });

    const pendingKyc = await this.vendorKycRepository.query({
      vendor: vendorId,
      status: KycStatus.PENDING,
    });

    if (pendingKyc) {
      await this.vendorKycRepository.updateOne(
        { _id: pendingKyc._id },
        { status: dto.status as KycStatus, notes: dto.notes },
      );
    }

    void this.dispatchKycDecisionEmail(
      vendorId,
      dto.status as KycStatus,
      dto.notes,
    );

    if (isApproved && this.kashiaService.isConfigured()) {
      void this.kashiaService
        .getOrCreateVendorCustomer(vendorId)
        .catch((error) => {
          this.logger.error(
            `Failed to register Kashia customer for approved vendor ${vendorId}`,
            error,
          );
        });
    }

    const updated = await this.vendorsRepository.query({ _id: vendorId });
    return this.Result(false, `Vendor ${dto.status} successfully`, updated);
  }

  private async dispatchKycDecisionEmail(
    vendorId: unknown,
    status: KycStatus,
    reason?: string,
  ): Promise<void> {
    try {
      const vendor = await this.vendorsRepository.query({ _id: vendorId });
      if (!vendor?.email) return;

      const vendorName = vendor.businessName || vendor.firstName;

      if (status === KycStatus.APPROVED) {
        await this.emailService.sendSafe({
          to: vendor.email,
          template: EmailTemplate.VENDOR_KYC_APPROVED,
          data: {
            vendorName,
            dashboardUrl: getAppWebUrl("/dashboard"),
          },
        });
        return;
      }

      if (status === KycStatus.REJECTED) {
        await this.emailService.sendSafe({
          to: vendor.email,
          template: EmailTemplate.VENDOR_KYC_REJECTED,
          data: {
            vendorName,
            reason,
            supportEmail: getSupportEmail(),
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `dispatchKycDecisionEmail: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getVendorDashboard(
    vendorId: string,
    paginationQuery: IPaginationQuery = { page: 1, itemsPerPage: 5 },
  ): PromisifiedOperationFeedback<VendorDashboardResponseDto> {
    try {
      const objectVendorId = this.utilsService.objectIdFromString(vendorId);
      const page = Math.max(1, Number(paginationQuery.page) || 1);
      const limit = Math.max(1, Number(paginationQuery.itemsPerPage) || 5);

      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      const prevSevenDaysAgo = new Date();
      prevSevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const prevThirtyDaysAgo = new Date();
      prevThirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 1. Summary Stats (Aggregated from Orders)
      const summaryStats = await this.ordersRepository.model.aggregate([
        { $unwind: "$items" },
        {
          $lookup: {
            from: DBCollectionNames.PRODUCTS,
            let: { productId: { $toObjectId: "$items.productId" } },
            pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$productId"] } } }],
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $match: {
            "product.vendorId": objectVendorId,
            status: OrderStatus.DELIVERED,
          },
        },
        {
          $group: {
            _id: null,
            totalBalance: { $sum: "$items.total" },
            revenue7: {
              $sum: {
                $cond: [
                  { $gte: ["$createdAt", sevenDaysAgo] },
                  "$items.total",
                  0,
                ],
              },
            },
            prevRevenue7: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$createdAt", prevSevenDaysAgo] },
                      { $lt: ["$createdAt", sevenDaysAgo] },
                    ],
                  },
                  "$items.total",
                  0,
                ],
              },
            },
            profits30: {
              $sum: {
                $cond: [
                  { $gte: ["$createdAt", thirtyDaysAgo] },
                  "$items.total",
                  0,
                ],
              },
            },
            prevProfits30: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$createdAt", prevThirtyDaysAgo] },
                      { $lt: ["$createdAt", thirtyDaysAgo] },
                    ],
                  },
                  "$items.total",
                  0,
                ],
              },
            },
          },
        },
      ]);

      const stats = summaryStats[0] || {
        totalBalance: 0,
        revenue7: 0,
        prevRevenue7: 0,
        profits30: 0,
        prevProfits30: 0,
      };

      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const summary = {
        availableBalance: { value: stats.totalBalance },
        revenue: {
          value: stats.revenue7,
          percentageChange: Math.abs(
            calculateChange(stats.revenue7, stats.prevRevenue7),
          ),
          isIncrease: stats.revenue7 >= stats.prevRevenue7,
        },
        profits: {
          value: stats.profits30,
          percentageChange: Math.abs(
            calculateChange(stats.profits30, stats.prevProfits30),
          ),
          isIncrease: stats.profits30 >= stats.prevProfits30,
        },
      };

      // 2. Engagement Metrics
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [monthlyBookmarks, totalProductLikes] = await Promise.all([
        this.usersFavouriteStoreRepository.count({
          vendorId: objectVendorId,
          createdAt: { $gte: startOfMonth },
        }),
        this.usersFavouriteProductRepository.model.aggregate([
          {
            $lookup: {
              from: DBCollectionNames.PRODUCTS,
              localField: "productId",
              foreignField: "_id",
              as: "product",
            },
          },
          { $unwind: "$product" },
          { $match: { "product.vendorId": objectVendorId } },
          { $count: "total" },
        ]),
      ]);

      const engagement = {
        monthlyStoreBookmarks: monthlyBookmarks,
        itemFavourites: totalProductLikes[0]?.total || 0,
      };

      // 3. Recent Customers (Paginated)
      const skip = (page - 1) * limit;
      const customersAgg = await this.ordersRepository.model.aggregate([
        { $unwind: "$items" },
        {
          $lookup: {
            from: DBCollectionNames.PRODUCTS,
            let: { productId: { $toObjectId: "$items.productId" } },
            pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$productId"] } } }],
            as: "product",
          },
        },
        { $unwind: "$product" },
        { $match: { "product.vendorId": objectVendorId } },
        {
          $group: {
            _id: "$userId",
            amount: { $sum: "$items.total" },
            lastTransaction: { $max: "$createdAt" },
          },
        },
        { $sort: { lastTransaction: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: DBCollectionNames.USERS,
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            userId: { $toString: "$_id" },
            name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
            amount: 1,
            lastTransaction: 1,
          },
        },
      ]);

      // 4. Top Performers
      const topPerformersAgg = await this.ordersRepository.model.aggregate([
        { $unwind: "$items" },
        {
          $lookup: {
            from: DBCollectionNames.PRODUCTS,
            let: { productId: { $toObjectId: "$items.productId" } },
            pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$productId"] } } }],
            as: "product",
          },
        },
        { $unwind: "$product" },
        {
          $match: {
            "product.vendorId": objectVendorId,
            status: OrderStatus.DELIVERED,
          },
        },
        {
          $group: {
            _id: "$items.productId",
            soldCount: { $sum: "$items.quantity" },
            product: { $first: "$product" },
          },
        },
        { $sort: { soldCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: DBCollectionNames.CATEGORIES,
            localField: "product.categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        {
          $lookup: {
            from: DBCollectionNames.SUBCATEGORIES,
            localField: "product.subcategoryId",
            foreignField: "_id",
            as: "subcategory",
          },
        },
        {
          $lookup: {
            from: DBCollectionNames.USERS_FAVORITE_PRODUCTS,
            let: { pid: { $toObjectId: "$_id" } },
            pipeline: [{ $match: { $expr: { $eq: ["$productId", "$$pid"] } } }],
            as: "likes",
          },
        },
        {
          $project: {
            productId: { $toString: "$_id" },
            name: "$product.name",
            image: { $arrayElemAt: ["$product.images", 0] },
            category: { $arrayElemAt: ["$category.name", 0] },
            subcategory: { $arrayElemAt: ["$subcategory.name", 0] },
            soldCount: 1,
            likeCount: { $size: "$likes" },
          },
        },
      ]);

      return this.Result(false, "Dashboard data retrieved successfully", {
        summary,
        engagement,
        recentCustomers: customersAgg,
        topPerformers: topPerformersAgg,
      });
    } catch (error: any) {
      this.logger.error(`getVendorDashboard error: ${error.message}`);
      return this.Result(
        true,
        "Failed to retrieve dashboard data",
        undefined,
        500,
      );
    }
  }

  async getVendorProducts(
    vendorId: string,
    paginationQuery: IPaginationQuery & {
      status?: ProductStatusFilter;
      sort?: ProductSortOption;
    } = { page: 1, itemsPerPage: 10 },
  ): PromisifiedOperationFeedback<VendorProductsResponseDto> {
    try {
      const objectVendorId = this.utilsService.objectIdFromString(vendorId);
      const page = Math.max(1, Number(paginationQuery.page) || 1);
      const limit = Math.max(1, Number(paginationQuery.itemsPerPage) || 10);
      const skip = (page - 1) * limit;

      const statusFilter = paginationQuery.status || ProductStatusFilter.ALL;
      const sortOption = paginationQuery.sort || ProductSortOption.NEWEST;

      const matchStage: any = { vendorId: objectVendorId };

      const getCommonStages = () => [
        // Join Categories
        {
          $lookup: {
            from: DBCollectionNames.CATEGORIES,
            localField: "categoryId",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        // Join Subcategories
        {
          $lookup: {
            from: DBCollectionNames.SUBCATEGORIES,
            localField: "subcategoryId",
            foreignField: "_id",
            as: "subcategory",
          },
        },
        { $unwind: { path: "$subcategory", preserveNullAndEmptyArrays: true } },
        // Calculate Stock
        {
          $addFields: {
            totalStock: {
              $cond: [
                { $eq: ["$hasVariations", true] },
                { $sum: "$variations.quantity" },
                { $ifNull: ["$defaultVariation.quantity", 0] },
              ],
            },
          },
        },
        {
          $addFields: {
            isSoldOut: { $lte: ["$totalStock", 0] },
          },
        },
        // Join Sales (DELIVERED Orders only)
        {
          $lookup: {
            from: DBCollectionNames.ORDERS,
            let: { pid: { $toString: "$_id" } },
            pipeline: [
              { $match: { status: OrderStatus.DELIVERED } },
              { $unwind: "$items" },
              {
                $match: {
                  $expr: {
                    $eq: [{ $toString: "$items.productId" }, "$$pid"],
                  },
                },
              },
              { $group: { _id: null, totalSold: { $sum: "$items.quantity" } } },
            ],
            as: "salesData",
          },
        },
        {
          $addFields: {
            soldCount: {
              $ifNull: [{ $arrayElemAt: ["$salesData.totalSold", 0] }, 0],
            },
          },
        },
        // Join Favourites (Likes)
        {
          $lookup: {
            from: DBCollectionNames.USERS_FAVORITE_PRODUCTS,
            let: { pid: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$productId", "$$pid"] } } },
              { $match: { isActive: true } },
              { $count: "count" },
            ],
            as: "likesData",
          },
        },
        {
          $addFields: {
            likeCount: {
              $ifNull: [{ $arrayElemAt: ["$likesData.count", 0] }, 0],
            },
          },
        },
      ];

      const finalProjection = {
        productId: { $toString: "$_id" },
        name: 1,
        image: { $arrayElemAt: ["$images", 0] },
        category: "$category.name",
        subcategory: "$subcategory.name",
        price: "$amount",
        soldCount: 1,
        likeCount: 1,
        isSoldOut: 1,
        totalStock: 1,
        createdAt: 1,
      };

      // 1. Get Top Performers (Top 5 by Delivered Sales)
      const topPerformersPipeline: PipelineStage[] = [
        { $match: matchStage },
        ...getCommonStages(),
      ];

      if (statusFilter === ProductStatusFilter.SOLD_OUT) {
        topPerformersPipeline.push({ $match: { isSoldOut: true } });
      } else if (statusFilter === ProductStatusFilter.ACTIVE) {
        topPerformersPipeline.push({ $match: { status: ProductStatus.ACTIVE } });
      }

      topPerformersPipeline.push(
        { $sort: { soldCount: -1, createdAt: -1 } },
        { $limit: 5 },
        { $project: finalProjection },
      );

      // 2. All Items (with pagination and filtering)
      const allItemsPipeline: PipelineStage[] = [
        { $match: matchStage },
        ...getCommonStages(),
      ];

      if (statusFilter === ProductStatusFilter.SOLD_OUT) {
        allItemsPipeline.push({ $match: { isSoldOut: true } });
      } else if (statusFilter === ProductStatusFilter.ACTIVE) {
        allItemsPipeline.push({ $match: { status: ProductStatus.ACTIVE } });
      }

      let sortStage: any = { createdAt: -1 };
      switch (sortOption) {
        case ProductSortOption.MOST_SOLD:
          sortStage = { soldCount: -1, createdAt: -1 };
          break;
        case ProductSortOption.MOST_LIKED:
          sortStage = { likeCount: -1, createdAt: -1 };
          break;
        case ProductSortOption.PRICE_HIGH_TO_LOW:
          sortStage = { amount: -1, createdAt: -1 };
          break;
        case ProductSortOption.PRICE_LOW_TO_HIGH:
          sortStage = { amount: 1, createdAt: -1 };
          break;
      }

      const countPipeline = [...allItemsPipeline, { $count: "total" }];

      allItemsPipeline.push(
        { $sort: sortStage },
        { $skip: skip },
        { $limit: limit },
        { $project: finalProjection },
      );

      const [topPerformers, allItems, totalResult] = await Promise.all([
        this.productsRepository.model.aggregate(topPerformersPipeline).exec(),
        this.productsRepository.model.aggregate(allItemsPipeline).exec(),
        this.productsRepository.model.aggregate(countPipeline).exec(),
      ]);

      const totalNum = totalResult[0]?.total || 0;
      const totalPages = Math.max(1, Math.ceil(totalNum / limit));

      return this.Result(false, "Vendor products retrieved successfully", {
        topPerformers,
        allItems,
        meta: {
          total: totalNum,
          page,
          limit,
          totalPages,
        },
      });
    } catch (error: any) {
      this.logger.error(`getVendorProducts error: ${error.message}`);
      return this.Result(
        true,
        "Failed to retrieve vendor products",
        undefined,
        500,
      );
    }
  }

  async getAdminStores(
    paginationQuery: IPaginationQuery = { page: 1, itemsPerPage: 10 },
    filters?: { approved?: boolean },
  ): PromisifiedOperationFeedback<AdminStoresResponseDto> {
    try {
      const page = Math.max(1, Number(paginationQuery.page) || 1);
      const limit = Math.max(1, Number(paginationQuery.itemsPerPage) || 10);
      const skip = (page - 1) * limit;

      const baseMatch: Record<string, unknown> = { isSignupCompleted: true };
      if (filters?.approved === false) {
        baseMatch.$or = [{ isApproved: false }, { isApproved: { $exists: false } }];
      } else if (filters?.approved === true) {
        baseMatch.isApproved = true;
      }

      const getStoreStatsPipeline = (): PipelineStage[] => [
        // Join with Orders to count delivered items sold
        {
          $lookup: {
            from: DBCollectionNames.ORDERS,
            let: { vendorId: "$_id" },
            pipeline: [
              { $match: { status: OrderStatus.DELIVERED } },
              { $unwind: "$items" },
              // We need to check if the product in the order item belongs to this vendor
              {
                $lookup: {
                  from: DBCollectionNames.PRODUCTS,
                  let: { pid: { $toObjectId: "$items.productId" } },
                  pipeline: [
                    { $match: { $expr: { $eq: ["$_id", "$$pid"] } } },
                    { $project: { vendorId: 1 } },
                  ],
                  as: "productInfo",
                },
              },
              { $unwind: "$productInfo" },
              {
                $match: {
                  $expr: { $eq: ["$productInfo.vendorId", "$$vendorId"] },
                },
              },
              {
                $group: {
                  _id: "$_id", // Count distinct orders
                  itemsCount: { $sum: "$items.quantity" },
                },
              },
              {
                $group: {
                  _id: null,
                  totalItemsSold: { $sum: "$itemsCount" },
                  totalOrders: { $count: {} },
                },
              },
            ],
            as: "orderStats",
          },
        },
        {
          $addFields: {
            totalItemsSold: {
              $ifNull: [{ $arrayElemAt: ["$orderStats.totalItemsSold", 0] }, 0],
            },
            totalOrders: {
              $ifNull: [{ $arrayElemAt: ["$orderStats.totalOrders", 0] }, 0],
            },
          },
        },
        {
          $project: {
            _id: 1,
            businessName: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            storeLogo: 1,
            storeCoverPhoto: 1,
            businessCategory: 1,
            totalItemsSold: 1,
            totalOrders: 1,
            isApproved: 1,
            isActive: 1,
            createdAt: 1,
          },
        },
      ];

      // 1. Get Top Stores (Most items sold)
      const topStores = await this.vendorsRepository.model.aggregate([
        { $match: baseMatch },
        ...getStoreStatsPipeline(),
        { $sort: { totalItemsSold: -1, totalOrders: -1, createdAt: -1 } },
        { $limit: 10 },
      ]);

      // 2. All Stores (Paginated)
      const allStoresPipeline: PipelineStage[] = [
        { $match: baseMatch },
        ...getStoreStatsPipeline(),
        { $sort: { createdAt: -1 } },
      ];

      const [allStores, totalNumResult] = await Promise.all([
        this.vendorsRepository.model.aggregate([
          ...allStoresPipeline,
          { $skip: skip },
          { $limit: limit },
        ]),
        this.vendorsRepository.model.aggregate([
          { $match: baseMatch },
          { $count: "total" },
        ]),
      ]);

      const totalNum = totalNumResult[0]?.total || 0;
      const totalPages = Math.ceil(totalNum / limit);

      return this.Result(false, "Admin stores retrieved successfully", {
        topStores,
        allStores,
        meta: {
          total: totalNum,
          page,
          limit,
          totalPages,
        },
      });
    } catch (error: any) {
      this.logger.error(`getAdminStores error: ${error.message}`);
      return this.Result(
        true,
        "Failed to retrieve admin stores",
        undefined,
        500,
      );
    }
  }

  async getVendorOrders(
    vendorId: string,
    options: PaginationOptions & { status?: OrderStatus } = {
      page: 1,
      limit: 10,
    },
  ): PromisifiedOperationFeedback<PaginatedResponse<Record<string, unknown>>> {
    try {
      const page = Math.max(1, Number(options.page) || 1);
      const limit = Math.max(1, Number(options.limit) || 10);
      const objectVendorId = this.utilsService.objectIdFromString(vendorId);

      const filter: Record<string, unknown> = { vendorId: objectVendorId };
      if (options.status) {
        filter.status = options.status;
      }

      const [result, total] = await Promise.all([
        this.ordersRepository.aggregate<Record<string, unknown>>(
          filter,
          [{ $sort: { createdAt: -1 } }],
          {},
          { page, itemsPerPage: limit },
        ),
        this.ordersRepository.count(filter),
      ]);

      const totalNum = Number(total);
      return this.Result(false, "Vendor orders retrieved successfully", {
        items: result?.items ?? [],
        meta: {
          total: totalNum,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(totalNum / limit)),
        },
      });
    } catch (error: any) {
      this.logger.error(`getVendorOrders error: ${error.message}`);
      return this.Result(true, "Failed to retrieve vendor orders", undefined, 500);
    }
  }

  async getVendorOrderById(
    vendorId: string,
    orderId: string,
  ): PromisifiedOperationFeedback<Record<string, unknown>> {
    try {
      const objectVendorId = this.utilsService.objectIdFromString(vendorId);
      const objectOrderId = this.utilsService.objectIdFromString(orderId);

      const order = await this.ordersRepository.query({
        _id: objectOrderId,
        vendorId: objectVendorId,
      });

      if (!order) {
        return this.Result(true, "Order not found", undefined, 404);
      }

      return this.Result(
        false,
        "Vendor order retrieved successfully",
        order as unknown as Record<string, unknown>,
      );
    } catch (error: any) {
      this.logger.error(`getVendorOrderById error: ${error.message}`);
      return this.Result(true, "Failed to retrieve order", undefined, 500);
    }
  }

  async updateVendorOrderStatus(
    vendorId: string,
    orderId: string,
    status: OrderStatus,
    description: string,
  ) {
    return this.ordersService.updateOrderStatus(
      orderId,
      status,
      description,
      "VENDOR",
      vendorId,
    );
  }

  /** @deprecated Replaced by direct { vendorId } queries on Order. */
  private vendorOrderMatchStage(vendorId: string): PipelineStage[] {
    const objectVendorId = this.utilsService.objectIdFromString(vendorId);
    return [
      { $unwind: "$items" },
      {
        $lookup: {
          from: DBCollectionNames.PRODUCTS,
          let: { productId: { $toObjectId: "$items.productId" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$productId"] } } },
          ],
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $match: { "product.vendorId": objectVendorId } },
    ];
  }

  async getVendorTransactions(
    vendorId: string,
    options: PaginationOptions = { page: 1, limit: 10 },
  ): PromisifiedOperationFeedback<PaginatedResponse<Record<string, unknown>>> {
    try {
      const page = Math.max(1, Number(options.page) || 1);
      const limit = Math.max(1, Number(options.limit) || 10);
      const skip = (page - 1) * limit;

      const [rows, countResult] = await Promise.all([
        this.ordersRepository.model.aggregate([
          ...this.vendorOrderMatchStage(vendorId),
          { $match: { status: OrderStatus.DELIVERED } },
          {
            $project: {
              orderId: "$_id",
              productName: "$items.name",
              quantity: "$items.quantity",
              amount: "$items.total",
              createdAt: 1,
            },
          },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        this.ordersRepository.model.aggregate([
          ...this.vendorOrderMatchStage(vendorId),
          { $match: { status: OrderStatus.DELIVERED } },
          { $count: "total" },
        ]),
      ]);

      const total = countResult[0]?.total ?? 0;
      return this.Result(false, "Transactions retrieved successfully", {
        items: rows,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error: any) {
      this.logger.error(`getVendorTransactions error: ${error.message}`);
      return this.Result(true, "Failed to retrieve transactions", undefined, 500);
    }
  }

  async getVendorCustomers(
    vendorId: string,
    options: PaginationOptions = { page: 1, limit: 10 },
  ): PromisifiedOperationFeedback<PaginatedResponse<Record<string, unknown>>> {
    try {
      const page = Math.max(1, Number(options.page) || 1);
      const limit = Math.max(1, Number(options.limit) || 10);
      const skip = (page - 1) * limit;

      const [customers, countResult] = await Promise.all([
        this.ordersRepository.model.aggregate([
          ...this.vendorOrderMatchStage(vendorId),
          {
            $group: {
              _id: "$userId",
              amount: { $sum: "$items.total" },
              lastTransaction: { $max: "$createdAt" },
              orderCount: { $sum: 1 },
            },
          },
          { $sort: { lastTransaction: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: DBCollectionNames.USERS,
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          {
            $project: {
              userId: { $toString: "$_id" },
              name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
              email: "$user.email",
              amount: 1,
              orderCount: 1,
              lastTransaction: 1,
            },
          },
        ]),
        this.ordersRepository.model.aggregate([
          ...this.vendorOrderMatchStage(vendorId),
          { $group: { _id: "$userId" } },
          { $count: "total" },
        ]),
      ]);

      const total = countResult[0]?.total ?? 0;
      return this.Result(false, "Customers retrieved successfully", {
        items: customers,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error: any) {
      this.logger.error(`getVendorCustomers error: ${error.message}`);
      return this.Result(true, "Failed to retrieve customers", undefined, 500);
    }
  }

  async getVendorCustomerById(
    vendorId: string,
    customerId: string,
  ): PromisifiedOperationFeedback<Record<string, unknown>> {
    try {
      const objectCustomerId =
        this.utilsService.objectIdFromString(customerId);

      const rows = await this.ordersRepository.model.aggregate([
        ...this.vendorOrderMatchStage(vendorId),
        { $match: { userId: objectCustomerId } },
        {
          $group: {
            _id: "$userId",
            amount: { $sum: "$items.total" },
            orderCount: { $sum: 1 },
            lastTransaction: { $max: "$createdAt" },
          },
        },
        {
          $lookup: {
            from: DBCollectionNames.USERS,
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            userId: { $toString: "$_id" },
            name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
            email: "$user.email",
            phone: "$user.phone",
            amount: 1,
            orderCount: 1,
            lastTransaction: 1,
          },
        },
      ]);

      if (!rows.length) {
        return this.Result(true, "Customer not found", undefined, 404);
      }

      return this.Result(false, "Customer retrieved successfully", rows[0]);
    } catch (error: any) {
      this.logger.error(`getVendorCustomerById error: ${error.message}`);
      return this.Result(true, "Failed to retrieve customer", undefined, 500);
    }
  }

  async getProductTransactions(
    vendorId: string,
    productId: string,
    options: PaginationOptions = { page: 1, limit: 10 },
  ): PromisifiedOperationFeedback<PaginatedResponse<Record<string, unknown>>> {
    try {
      const page = Math.max(1, Number(options.page) || 1);
      const limit = Math.max(1, Number(options.limit) || 10);
      const skip = (page - 1) * limit;
      const objectProductId = this.utilsService.objectIdFromString(productId);

      const product = await this.productsRepository.query({
        _id: objectProductId,
        vendorId: this.utilsService.objectIdFromString(vendorId),
      });
      if (!product) {
        return this.Result(true, "Product not found", undefined, 404);
      }

      const [rows, countResult] = await Promise.all([
        this.ordersRepository.model.aggregate([
          ...this.vendorOrderMatchStage(vendorId),
          { $match: { "items.productId": productId } },
          {
            $project: {
              orderId: "$_id",
              quantity: "$items.quantity",
              amount: "$items.total",
              status: 1,
              createdAt: 1,
            },
          },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ]),
        this.ordersRepository.model.aggregate([
          ...this.vendorOrderMatchStage(vendorId),
          { $match: { "items.productId": productId } },
          { $count: "total" },
        ]),
      ]);

      const total = countResult[0]?.total ?? 0;
      return this.Result(false, "Product transactions retrieved successfully", {
        items: rows,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error: any) {
      this.logger.error(`getProductTransactions error: ${error.message}`);
      return this.Result(
        true,
        "Failed to retrieve product transactions",
        undefined,
        500,
      );
    }
  }

  async getProductChart(
    vendorId: string,
    productId: string,
  ): PromisifiedOperationFeedback<{ labels: string[]; values: number[] }> {
    try {
      const objectProductId = this.utilsService.objectIdFromString(productId);
      const product = await this.productsRepository.query({
        _id: objectProductId,
        vendorId: this.utilsService.objectIdFromString(vendorId),
      });
      if (!product) {
        return this.Result(true, "Product not found", undefined, 404);
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const daily = await this.ordersRepository.model.aggregate([
        ...this.vendorOrderMatchStage(vendorId),
        {
          $match: {
            "items.productId": productId,
            status: OrderStatus.DELIVERED,
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            revenue: { $sum: "$items.total" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return this.Result(false, "Product chart retrieved successfully", {
        labels: daily.map((d) => d._id),
        values: daily.map((d) => d.revenue),
      });
    } catch (error: any) {
      this.logger.error(`getProductChart error: ${error.message}`);
      return this.Result(true, "Failed to retrieve product chart", undefined, 500);
    }
  }
}
