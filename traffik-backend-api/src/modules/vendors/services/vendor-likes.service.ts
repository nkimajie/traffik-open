import { Injectable, Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { BaseService } from "src/modules/shared/base/service.base";
import { PromisifiedOperationFeedback } from "src/modules/shared/types/promisified_operation_feedback.type";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { VendorLikesRepository } from "../repositories/vendor-likes.repository";
import { VendorsRepository } from "../repositories/vendors.repository";

export interface VendorLikeToggleResult {
  isLiked: boolean;
  totalLikes: number;
}

@Injectable()
export class VendorLikesService extends BaseService {
  private readonly logger = new Logger(VendorLikesService.name);

  constructor(
    private readonly vendorLikesRepository: VendorLikesRepository,
    private readonly vendorsRepository: VendorsRepository,
    private readonly utilsService: UtilsService,
  ) {
    super();
  }

  private async syncVendorTotalLikes(
    vendorOid: Types.ObjectId,
  ): Promise<number> {
    const total = await this.vendorLikesRepository.count({
      vendorId: vendorOid,
    });
    await this.vendorsRepository.update({ _id: vendorOid }, {
      $set: { totalLikes: total },
    } as never);
    return total;
  }

  async isLikedByUser(vendorId: string, userId: string): Promise<boolean> {
    try {
      if (
        !Types.ObjectId.isValid(vendorId) ||
        !Types.ObjectId.isValid(userId)
      ) {
        return false;
      }
      const exists = await this.vendorLikesRepository.exists({
        vendorId: this.utilsService.objectIdFromString(vendorId),
        userId: this.utilsService.objectIdFromString(userId),
      });
      return !!exists;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`isLikedByUser: ${msg}`);
      return false;
    }
  }

  /**
   * Which of the given vendor ids the user has liked (buyer only; pass valid userId).
   */
  async getLikedVendorIdSet(
    userId: string,
    vendorIds: string[],
  ): Promise<Set<string>> {
    const set = new Set<string>();
    const unique = [
      ...new Set(vendorIds.map((id) => String(id).trim()).filter(Boolean)),
    ];
    if (!unique.length || !Types.ObjectId.isValid(userId)) {
      return set;
    }

    const validVendorIds = unique.filter((id) => Types.ObjectId.isValid(id));
    if (!validVendorIds.length) {
      return set;
    }

    try {
      const userOid = this.utilsService.objectIdFromString(userId);
      const vendorOids = validVendorIds.map((id) =>
        this.utilsService.objectIdFromString(id),
      );

      const rows = await this.vendorLikesRepository.model
        .find({
          userId: userOid,
          vendorId: { $in: vendorOids },
        })
        .select({ vendorId: 1 })
        .lean()
        .exec();

      for (const row of rows) {
        set.add(String(row.vendorId));
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`getLikedVendorIdSet: ${msg}`);
    }

    return set;
  }

  /** Toggle like for an active store; buyers only (enforced by controller). */
  async toggleLike(
    vendorId: string,
    userId: string,
  ): PromisifiedOperationFeedback<VendorLikeToggleResult> {
    try {
      const vendorOid = this.utilsService.objectIdFromString(vendorId);
      const userOid = this.utilsService.objectIdFromString(userId);

      const vendor = await this.vendorsRepository.query({
        _id: vendorOid,
        isActive: true,
        isSignupCompleted: true,
      });
      if (!vendor) {
        return this.Result(
          true,
          "Store not found or not active",
          undefined,
          404,
        );
      }

      const existing = await this.vendorLikesRepository.exists({
        vendorId: vendorOid,
        userId: userOid,
      });

      if (existing) {
        await this.vendorLikesRepository.delete({
          vendorId: vendorOid,
          userId: userOid,
        });
        const totalLikes = await this.syncVendorTotalLikes(vendorOid);
        return this.Result(false, "Like removed", {
          isLiked: false,
          totalLikes,
        });
      }

      await this.vendorLikesRepository.model.create({
        vendorId: vendorOid,
        userId: userOid,
      });
      const totalLikes = await this.syncVendorTotalLikes(vendorOid);
      return this.Result(false, "Store liked", { isLiked: true, totalLikes });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`toggleLike: ${msg}`);
      return this.Result(true, "Failed to update like", undefined, 500);
    }
  }
}
