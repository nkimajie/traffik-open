import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "src/modules/shared/base/repository.base";
import { DBCollectionNames } from "src/modules/shared/enums/db_collections_name.enum";
import { PlatformSettingsDocument } from "../schemas/platform-settings.schema";

const DEFAULT_SETTINGS_KEY = "default";

@Injectable()
export class PlatformSettingsRepository extends BaseRepository<PlatformSettingsDocument> {
  constructor(
    @InjectModel(DBCollectionNames.PLATFORM_SETTINGS)
    model: Model<PlatformSettingsDocument>,
  ) {
    super(model);
  }

  async getOrCreateDefault(): Promise<PlatformSettingsDocument> {
    const existing = await this.query({ key: DEFAULT_SETTINGS_KEY });
    if (existing) {
      return existing;
    }

    return this.create({
      key: DEFAULT_SETTINGS_KEY,
      commissionPercentage: 0,
    } as PlatformSettingsDocument);
  }
}
