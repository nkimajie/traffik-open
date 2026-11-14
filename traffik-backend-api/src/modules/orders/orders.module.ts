import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OrdersController } from "./controllers/orders.controller";
import { OrdersPublicController } from "./controllers/orders-public.controller";
import { OrdersService } from "./services/orders.service";
import { AbandonedCheckoutsSweeperService } from "./services/abandoned-checkouts-sweeper.service";
import { OrdersRepository } from "./repositories/orders.repository";
import { Order, OrderSchema } from "./schemas/order.schema";
import { RefundPayoutReferenceSchema } from "./schemas/refund-payout-reference.schema";
import { RefundPayoutReferencesRepository } from "./repositories/refund-payout-references.repository";
import { DBCollectionNames } from "../shared/enums/db_collections_name.enum";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { CartsModule } from "../carts/carts.module";
import { AddressesModule } from "../addresses/addresses.module";
import { SharedModule } from "../shared/shared.module";
import { UsersModule } from "../users/users.module";
import { ProductsModule } from "../products/products.module";
import { VendorsModule } from "../vendors/vendors.module";
import { EscrowModule } from "../escrow/escrow.module";
import { AdminModule } from "../admin/admin.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      {
        name: DBCollectionNames.REFUND_PAYOUT_REFERENCES,
        schema: RefundPayoutReferenceSchema,
        collection: DBCollectionNames.REFUND_PAYOUT_REFERENCES,
      },
    ]),
    forwardRef(() => CartsModule),
    AddressesModule,
    SharedModule,
    forwardRef(() => UsersModule),
    forwardRef(() => ProductsModule),
    forwardRef(() => VendorsModule),
    forwardRef(() => EscrowModule),
    AdminModule,
  ],
  controllers: [OrdersController, OrdersPublicController],
  providers: [
    OrdersService,
    AbandonedCheckoutsSweeperService,
    OrdersRepository,
    RefundPayoutReferencesRepository,
    UtilsService,
  ],
  exports: [OrdersService, OrdersRepository, AbandonedCheckoutsSweeperService],
})
export class OrdersModule {}
