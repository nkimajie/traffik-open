import { Injectable } from "@nestjs/common";
import { BaseService } from "src/modules/shared/base/service.base";
import { PromisifiedOperationFeedback } from "src/modules/shared/types/promisified_operation_feedback.type";
import { PlatformSettingsRepository } from "../repositories/platform-settings.repository";
import { PlatformSettingsDocument } from "../schemas/platform-settings.schema";

export interface PlatformSettingsView {
  commissionPercentage: number;
  updatedAt?: Date;
}

@Injectable()
export class PlatformSettingsService extends BaseService {
  constructor(
    private readonly platformSettingsRepository: PlatformSettingsRepository,
  ) {
    super();
  }

  async getSettings(): PromisifiedOperationFeedback<PlatformSettingsView> {
    const doc = await this.platformSettingsRepository.getOrCreateDefault();
    return this.Result(false, "Platform settings retrieved", this.toView(doc));
  }

  async getCommissionPercentage(): Promise<number> {
    const doc = await this.platformSettingsRepository.getOrCreateDefault();
    return doc.commissionPercentage ?? 0;
  }

  async updateSettings(dto: {
    commissionPercentage: number;
  }): PromisifiedOperationFeedback<PlatformSettingsView> {
    await this.platformSettingsRepository.getOrCreateDefault();

    const updated = await this.platformSettingsRepository.updateOne(
      { key: "default" },
      { commissionPercentage: dto.commissionPercentage },
    );

    if (!updated) {
      return this.Result(true, "Failed to update platform settings", undefined, 500);
    }

    return this.Result(
      false,
      "Platform settings updated",
      this.toView(updated),
    );
  }

  private toView(doc: PlatformSettingsDocument): PlatformSettingsView {
    return {
      commissionPercentage: doc.commissionPercentage ?? 0,
      updatedAt: doc.updatedAt,
    };
  }
}
