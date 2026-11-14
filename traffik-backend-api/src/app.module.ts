import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DatabaseModule } from "./database/database.module";
import { SharedModule } from "./modules/shared/shared.module";
import { AuthenticationModule } from "./modules/authentication/authentication.module";
import { UsersModule } from "./modules/users/users.module";
import { WaitlistModule } from "./modules/waitlist/waitlist.module";
import { FilesModule } from "./modules/files/files.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { ProductsModule } from "./modules/products/products.module";
import { VouchersModule } from "./modules/vouchers/vouchers.module";
import { CartsModule } from "./modules/carts/carts.module";
import { AddressesModule } from "./modules/addresses/addresses.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { AdminModule } from "./modules/admin/admin.module";
import { EscrowModule } from "./modules/escrow/escrow.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Runs @Cron jobs of the modules loaded here (e.g. the sweep of
    // abandoned checkouts). AutomationModule is deliberately not loaded:
    // its file clean-up job deletes files from Cloudinary.
    ScheduleModule.forRoot(),
    DatabaseModule,
    SharedModule,
    AuthenticationModule,
    AdminModule,
    UsersModule,
    WaitlistModule,
    FilesModule,
    CategoriesModule,
    ProductsModule,
    VouchersModule,
    CartsModule,
    AddressesModule,
    EscrowModule,
    OrdersModule,
    CatalogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
