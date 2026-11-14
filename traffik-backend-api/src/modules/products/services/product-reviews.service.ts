import { Injectable, Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { roundRating } from "src/common/utils/number.util";
import { PaginatedResponse } from "src/common/interfaces/paginated-response.interface";
import { PaginationOptions } from "src/common/interfaces/pagination-options.interface";
import { BaseService } from "src/modules/shared/base/service.base";
import { PromisifiedOperationFeedback } from "src/modules/shared/types/promisified_operation_feedback.type";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { UserRole } from "src/modules/users/enums/user-role.enum";
import { UsersRepository } from "src/modules/users/repositories/users.repository";
import { IUser } from "src/modules/users/interfaces/users.interface";
import { OrdersService } from "src/modules/orders/services/orders.service";
import { ProductStatus } from "../enums/product-status.enum";
import { ProductReviewsRepository } from "../repositories/product-reviews.repository";
import { ProductReviewHelpfulRepository } from "../repositories/product-review-helpful.repository";
import { ProductsRepository } from "../repositories/products.repository";

export interface ProductReviewSummary {
  averageRating: number;
  totalRatings: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
}

export interface ProductReviewListItem {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  markedHelpfulByMe: boolean;
  reviewer: {
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface JwtReviewUser {
  _id: string;
  role: string;
}

@Injectable()
export class ProductReviewsService extends BaseService {
  private readonly logger = new Logger(ProductReviewsService.name);

  constructor(
    private readonly reviewsRepository: ProductReviewsRepository,
    private readonly helpfulRepository: ProductReviewHelpfulRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly ordersService: OrdersService,
    private readonly utilsService: UtilsService,
    private readonly usersRepository: UsersRepository,
  ) {
    super();
  }

  async getSummary(
    productId: string,
  ): PromisifiedOperationFeedback<ProductReviewSummary> {
    try {
      const productOid = this.utilsService.objectIdFromString(productId);
      const exists = await this.productsRepository.exists({
        _id: productOid,
        status: ProductStatus.ACTIVE,
      });
      if (!exists) {
        return this.Result(true, "Product not found", undefined, 404);
      }

      const rows = await this.reviewsRepository.model
        .aggregate<{ _id: number; count: number }>([
          { $match: { productId: productOid } },
          { $group: { _id: "$rating", count: { $sum: 1 } } },
        ])
        .exec();

      const distribution: ProductReviewSummary["distribution"] = {
        "1": 0,
        "2": 0,
        "3": 0,
        "4": 0,
        "5": 0,
      };
      let totalRatings = 0;
      let sum = 0;
      for (const row of rows) {
        const key = String(row._id) as keyof typeof distribution;
        if (key in distribution) {
          distribution[key] = row.count;
          totalRatings += row.count;
          sum += row._id * row.count;
        }
      }

      const averageRating =
        totalRatings === 0
          ? 0
          : Math.round((sum / totalRatings) * 10) / 10;

      return this.Result(false, "Review summary retrieved", {
        averageRating,
        totalRatings,
        distribution,
      });
    } catch (error: any) {
      this.logger.error(`getSummary: ${error?.message}`);
      return this.Result(true, "Failed to load review summary", undefined, 500);
    }
  }

  async listReviews(
    productId: string,
    options: PaginationOptions = { page: 1, limit: 10 },
    currentUserId?: string,
  ): PromisifiedOperationFeedback<PaginatedResponse<ProductReviewListItem>> {
    try {
      const productOid = this.utilsService.objectIdFromString(productId);
      const exists = await this.productsRepository.exists({
        _id: productOid,
        status: ProductStatus.ACTIVE,
      });
      if (!exists) {
        return this.Result(true, "Product not found", undefined, 404);
      }

      const pageNum = Math.max(1, Number(options.page) || 1);
      const limitNum = Math.max(1, Number(options.limit) || 10);
      const filter = { productId: productOid };

      const [docs, total] = await Promise.all([
        this.reviewsRepository.model
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean()
          .exec(),
        this.reviewsRepository.count(filter),
      ]);

      const ids = docs.map((d) => String(d._id));
      const helpfulSet = await this.buildHelpfulSetForUser(ids, currentUserId);

      const items = docs.map((d) =>
        this.mapReviewDoc(d, helpfulSet, currentUserId),
      );

      const totalNum = Number(total);
      const totalPages = Math.max(1, Math.ceil(totalNum / limitNum));

      return this.Result(false, "Reviews retrieved", {
        items,
        meta: {
          total: totalNum,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
      });
    } catch (error: any) {
      this.logger.error(`listReviews: ${error?.message}`);
      return this.Result(true, "Failed to load reviews", undefined, 500);
    }
  }

  /**
   * Most recent review for a product (same shape as list items). Used on product detail.
   */
  async getLatestReviewForProduct(
    productId: string,
    currentUserId?: string,
  ): Promise<ProductReviewListItem | null> {
    const map = await this.getLatestReviewMapForProductIds(
      [productId],
      currentUserId,
    );
    return map.get(String(productId)) ?? null;
  }

  /**
   * One newest review per productId (for batching on product lists).
   */
  async getLatestReviewMapForProductIds(
    productIds: string[],
    currentUserId?: string,
  ): Promise<Map<string, ProductReviewListItem | null>> {
    const map = new Map<string, ProductReviewListItem | null>();
    const unique = [...new Set(productIds.map((id) => String(id).trim()).filter(Boolean))];
    if (!unique.length) {
      return map;
    }

    try {
      const oids = unique.map((id) => this.utilsService.objectIdFromString(id));

      const grouped = await this.reviewsRepository.model
        .aggregate<{ _id: Types.ObjectId; doc: Record<string, unknown> }>([
          { $match: { productId: { $in: oids } } },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: "$productId",
              doc: { $first: "$$ROOT" },
            },
          },
        ])
        .exec();

      const reviewIds = grouped.map((g) => String(g.doc._id));
      const helpfulSet = await this.buildHelpfulSetForUser(
        reviewIds,
        currentUserId,
      );

      for (const g of grouped) {
        const pid = String(g._id);
        map.set(pid, this.mapReviewDoc(g.doc, helpfulSet, currentUserId));
      }

      return map;
    } catch (error: any) {
      this.logger.error(`getLatestReviewMapForProductIds: ${error?.message}`);
      return map;
    }
  }

  async createReview(
    productId: string,
    reviewer: JwtReviewUser,
    body: {
      rating: number;
      comment: string;
      images: string[];
      orderId?: string | null;
    },
  ): PromisifiedOperationFeedback<ProductReviewListItem> {
    try {
      if (reviewer.role?.toUpperCase() !== UserRole.USER.toUpperCase()) {
        return this.Result(
          true,
          "Only buyers can submit product reviews",
          undefined,
          403,
        );
      }

      const productOid = this.utilsService.objectIdFromString(productId);
      const product = await this.productsRepository.query({
        _id: productOid,
        status: ProductStatus.ACTIVE,
      });

      if (!product) {
        return this.Result(true, "Product not found", undefined, 404);
      }

      const profile = await this.loadReviewerProfile(reviewer._id);
      if (!profile) {
        return this.Result(true, "User not found", undefined, 404);
      }

      let isVerifiedPurchase = false;
      let orderOid: Types.ObjectId | null = null;
      const rawOrderId = body.orderId?.trim();
      if (rawOrderId) {
        const ok = await this.ordersService.verifyDeliveredOrderContainsProduct(
          reviewer._id,
          rawOrderId,
          productId,
        );
        if (!ok) {
          return this.Result(
            true,
            "Order is not eligible for a verified review for this product",
            undefined,
            400,
          );
        }
        isVerifiedPurchase = true;
        orderOid = this.utilsService.objectIdFromString(rawOrderId) as Types.ObjectId;
      }

      const userOid = this.utilsService.objectIdFromString(reviewer._id);

      let created: any;
      try {
        created = await this.reviewsRepository.model.create({
          productId: productOid,
          userId: userOid,
          rating: body.rating,
          comment: body.comment ?? "",
          images: body.images ?? [],
          orderId: orderOid,
          isVerifiedPurchase,
          helpfulCount: 0,
          reviewerDisplayName: profile.displayName,
          reviewerAvatarUrl: profile.avatarUrl,
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          return this.Result(
            true,
            "You have already reviewed this product",
            undefined,
            409,
          );
        }
        throw err;
      }

      await this.syncProductReviewAggregates(productOid);

      const plain = created.toObject ? created.toObject() : created;
      const helpfulSet = new Set<string>();
      return this.Result(
        false,
        "Review created",
        this.mapReviewDoc(plain, helpfulSet, reviewer._id),
        201,
      );
    } catch (error: any) {
      this.logger.error(`createReview: ${error?.message}`);
      return this.Result(true, "Failed to create review", undefined, 500);
    }
  }

  async updateReview(
    productId: string,
    reviewId: string,
    reviewer: JwtReviewUser,
    body: { rating?: number; comment?: string; images?: string[] },
  ): PromisifiedOperationFeedback<ProductReviewListItem> {
    try {
      if (reviewer.role?.toUpperCase() !== UserRole.USER.toUpperCase()) {
        return this.Result(true, "Forbidden", undefined, 403);
      }

      const productOid = this.utilsService.objectIdFromString(productId);
      const reviewOid = this.utilsService.objectIdFromString(reviewId);
      const userOid = this.utilsService.objectIdFromString(reviewer._id);

      const existing = await this.reviewsRepository.query({
        _id: reviewOid,
        productId: productOid,
        userId: userOid,
      });

      if (!existing) {
        return this.Result(true, "Review not found", undefined, 404);
      }

      const profile = await this.loadReviewerProfile(reviewer._id);
      const update: Record<string, unknown> = {};
      if (body.rating !== undefined) {
        update.rating = body.rating;
      }
      if (body.comment !== undefined) {
        update.comment = body.comment;
      }
      if (body.images !== undefined) {
        update.images = body.images;
      }
      if (profile) {
        update.reviewerDisplayName = profile.displayName;
        update.reviewerAvatarUrl = profile.avatarUrl;
      }

      const updated = await this.reviewsRepository.update(
        { _id: reviewOid },
        { $set: update } as any,
      );

      await this.syncProductReviewAggregates(productOid);

      const helpfulSet = await this.buildHelpfulSetForUser(
        [reviewId],
        reviewer._id,
      );
      return this.Result(
        false,
        "Review updated",
        this.mapReviewDoc(updated as any, helpfulSet, reviewer._id),
      );
    } catch (error: any) {
      this.logger.error(`updateReview: ${error?.message}`);
      return this.Result(true, "Failed to update review", undefined, 500);
    }
  }

  async deleteReview(
    productId: string,
    reviewId: string,
    reviewer: JwtReviewUser,
  ): PromisifiedOperationFeedback<null> {
    try {
      if (reviewer.role?.toUpperCase() !== UserRole.USER.toUpperCase()) {
        return this.Result(true, "Forbidden", undefined, 403);
      }

      const productOid = this.utilsService.objectIdFromString(productId);
      const reviewOid = this.utilsService.objectIdFromString(reviewId);
      const userOid = this.utilsService.objectIdFromString(reviewer._id);

      const removed = await this.reviewsRepository.delete({
        _id: reviewOid,
        productId: productOid,
        userId: userOid,
      });

      if (!removed) {
        return this.Result(true, "Review not found", undefined, 404);
      }

      await this.helpfulRepository.deleteAll({ reviewId: reviewOid });
      await this.syncProductReviewAggregates(productOid);

      return this.Result(false, "Review deleted", null);
    } catch (error: any) {
      this.logger.error(`deleteReview: ${error?.message}`);
      return this.Result(true, "Failed to delete review", undefined, 500);
    }
  }

  async markHelpful(
    productId: string,
    reviewId: string,
    user: JwtReviewUser,
  ): PromisifiedOperationFeedback<{ helpfulCount: number }> {
    try {
      if (user.role?.toUpperCase() !== UserRole.USER.toUpperCase()) {
        return this.Result(true, "Forbidden", undefined, 403);
      }

      const productOid = this.utilsService.objectIdFromString(productId);
      const reviewOid = this.utilsService.objectIdFromString(reviewId);
      const userOid = this.utilsService.objectIdFromString(user._id);

      const review = await this.reviewsRepository.query({
        _id: reviewOid,
        productId: productOid,
      });

      if (!review) {
        return this.Result(true, "Review not found", undefined, 404);
      }

      if (review.userId?.toString() === user._id.toString()) {
        return this.Result(true, "You cannot mark your own review as helpful", undefined, 400);
      }

      try {
        await this.helpfulRepository.model.create({
          reviewId: reviewOid,
          userId: userOid,
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          return this.Result(true, "You already marked this review as helpful", undefined, 409);
        }
        throw err;
      }

      const updated = await this.reviewsRepository.update(
        { _id: reviewOid },
        { $inc: { helpfulCount: 1 } } as any,
      );

      const count = Number((updated as any)?.helpfulCount ?? 0);

      return this.Result(false, "Marked as helpful", {
        helpfulCount: count,
      });
    } catch (error: any) {
      this.logger.error(`markHelpful: ${error?.message}`);
      return this.Result(true, "Failed to mark helpful", undefined, 500);
    }
  }

  private mapReviewDoc(
    doc: any,
    helpfulSet: Set<string>,
    currentUserId?: string,
  ): ProductReviewListItem {
    const id = doc._id?.toString?.() ?? String(doc._id);
    return {
      id,
      rating: doc.rating,
      comment: doc.comment ?? "",
      images: doc.images || [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      isVerifiedPurchase: !!doc.isVerifiedPurchase,
      helpfulCount: doc.helpfulCount ?? 0,
      markedHelpfulByMe: currentUserId ? helpfulSet.has(id) : false,
      reviewer: {
        displayName: doc.reviewerDisplayName ?? "User",
        avatarUrl: doc.reviewerAvatarUrl ?? null,
      },
    };
  }

  private async buildHelpfulSetForUser(
    reviewIds: string[],
    currentUserId?: string,
  ): Promise<Set<string>> {
    const set = new Set<string>();
    if (!currentUserId || reviewIds.length === 0) {
      return set;
    }
    const userOid = this.utilsService.objectIdFromString(currentUserId);
    const oids = reviewIds.map((id) => this.utilsService.objectIdFromString(id));
    const votes = await this.helpfulRepository.model
      .find({
        userId: userOid,
        reviewId: { $in: oids },
      })
      .select({ reviewId: 1 })
      .lean()
      .exec();
    for (const v of votes) {
      set.add(String(v.reviewId));
    }
    return set;
  }

  private async loadReviewerProfile(userId: string): Promise<{
    displayName: string;
    avatarUrl: string | null;
  } | null> {
    const u = (await this.usersRepository.query({
      _id: this.utilsService.objectIdFromString(userId),
    })) as IUser | null;
    if (!u) {
      return null;
    }
    const displayName =
      `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User";
    const avatarUrl = u.profilePicture?.url ?? null;
    return { displayName, avatarUrl };
  }

  private async syncProductReviewAggregates(productId: Types.ObjectId) {
    const result = await this.reviewsRepository.model
      .aggregate<{ avg: number; total: number }>([
        { $match: { productId } },
        {
          $group: {
            _id: null,
            avg: { $avg: "$rating" },
            total: { $sum: 1 },
          },
        },
      ])
      .exec();

    if (!result.length) {
      await this.productsRepository.update(
        { _id: productId },
        { $set: { rating: 0, totalRatings: 0 } } as any,
      );
      return;
    }

    const avg = roundRating(result[0].avg);
    await this.productsRepository.update(
      { _id: productId },
      { $set: { rating: avg, totalRatings: result[0].total } } as any,
    );
  }
}
