import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  PublicVendorsController,
  VendorsController,
} from "./controllers/vendors.controller";
import { VendorsService } from "./services/vendors.service";
import { VendorLikesService } from "./services/vendor-likes.service";
import { VendorsRepository } from "./repositories/vendors.repository";
import { VendorLikesRepository } from "./repositories/vendor-likes.repository";
import { VendorKycRepository } from "./repositories/vendor-kyc.repository";
import { VendorSchema } from "./schemas/vendor.schema";
import { VendorLikeSchema } from "./schemas/vendor-like.schema";
import { VendorKycSchema } from "./schemas/vendor-kyc.schema";
import { DBCollectionNames } from "../shared/enums/db_collections_name.enum";
import { FilesModule } from "../files/files.module";
import { SharedModule } from "../shared/shared.module";
import { ProductsModule } from "../products/products.module";
import { UsersModule } from "../users/users.module";
import { OrdersModule } from "../orders/orders.module";
import { CategoriesModule } from "../categories/categories.module";
import { EscrowModule } from "../escrow/escrow.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DBCollectionNames.VENDORS, schema: VendorSchema },
      { name: DBCollectionNames.VENDOR_LIKES, schema: VendorLikeSchema },
      { name: DBCollectionNames.VENDOR_KYC, schema: VendorKycSchema },
    ]),
    FilesModule,
    SharedModule,
    forwardRef(() => ProductsModule),
    forwardRef(() => UsersModule),
    forwardRef(() => OrdersModule),
    CategoriesModule,
    EscrowModule,
  ],
  controllers: [VendorsController, PublicVendorsController],
  providers: [
    VendorsService,
    VendorsRepository,
    VendorLikesService,
    VendorLikesRepository,
    VendorKycRepository,
  ],
  exports: [VendorsService, VendorsRepository, VendorKycRepository],
})
export class VendorsModule {}
