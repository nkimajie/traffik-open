import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminService } from "./services/admin.service";
import { AdminRepository } from "./repositories/admin.repository";
import { AdminSchema } from "./schemas/admin.schema";
import { DBCollectionNames } from "../shared/enums/db_collections_name.enum";
import { SharedModule } from "../shared/shared.module";
import { AdminEmailService } from "./services/admin-email.service";
import { AdminEmailController } from "./controllers/admin-email.controller";
import { AdminSettingsController } from "./controllers/admin-settings.controller";
import { PlatformSettingsService } from "./services/platform-settings.service";
import { PlatformSettingsRepository } from "./repositories/platform-settings.repository";
import {
  PlatformSettings,
  PlatformSettingsSchema,
} from "./schemas/platform-settings.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DBCollectionNames.ADMINS, schema: AdminSchema },
      {
        name: DBCollectionNames.PLATFORM_SETTINGS,
        schema: PlatformSettingsSchema,
        collection: DBCollectionNames.PLATFORM_SETTINGS,
      },
    ]),
    SharedModule,
  ],
  controllers: [AdminEmailController, AdminSettingsController],
  providers: [
    AdminService,
    AdminRepository,
    AdminEmailService,
    PlatformSettingsService,
    PlatformSettingsRepository,
  ],
  exports: [AdminService, PlatformSettingsService],
})
export class AdminModule {}
