import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WaitlistService } from "./services/waitlist.service";
import { WaitlistController } from "./controllers/waitlist.controller";
import { WaitlistSchema } from "./schemas/waitlist.schema";
import { WaitlistRepository } from "./repositories/waitlist.repository";
import { DBCollectionNames } from "../shared/enums/db_collections_name.enum";
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: DBCollectionNames.WAITLIST,
        schema: WaitlistSchema,
        collection: DBCollectionNames.WAITLIST,
      },
    ]),
  ],
  controllers: [WaitlistController],
  providers: [WaitlistService, WaitlistRepository],
  exports: [WaitlistService],
})
export class WaitlistModule {}
