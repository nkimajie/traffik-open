import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { KashiaService } from "./services/kashia.service";
import { KashiaWebhookService } from "./services/kashia-webhook.service";
import { KashiaWebhookReplayService } from "./services/kashia-webhook-replay.service";
import { KashiaWebhookController } from "./controllers/kashia-webhook.controller";
import { UsersModule } from "../users/users.module";
import { VendorsModule } from "../vendors/vendors.module";
import { OrdersModule } from "../orders/orders.module";
import { DBCollectionNames } from "../shared/enums/db_collections_name.enum";
import {
  KashiaWebhookEvent,
  KashiaWebhookEventSchema,
} from "./schemas/kashia-webhook-event.schema";
import { KashiaWebhookEventsRepository } from "./repositories/kashia-webhook-events.repository";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: DBCollectionNames.KASHIA_WEBHOOK_EVENTS,
        schema: KashiaWebhookEventSchema,
        collection: DBCollectionNames.KASHIA_WEBHOOK_EVENTS,
      },
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => VendorsModule),
    forwardRef(() => OrdersModule),
  ],
  controllers: [KashiaWebhookController],
  providers: [
    KashiaService,
    KashiaWebhookService,
    KashiaWebhookReplayService,
    KashiaWebhookEventsRepository,
  ],
  exports: [KashiaService, KashiaWebhookReplayService],
})
export class EscrowModule {}
