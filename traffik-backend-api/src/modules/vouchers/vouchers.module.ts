import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { VouchersController } from "./controllers/vouchers.controller";
import { VouchersService } from "./services/vouchers.service";
import { VouchersRepository } from "./repositories/vouchers.repository";
import { VoucherSchema } from "./schemas/voucher.schema";
import { DBCollectionNames } from "../shared/enums/db_collections_name.enum";
import { SharedModule } from "../shared/shared.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DBCollectionNames.VOUCHERS, schema: VoucherSchema },
    ]),
    SharedModule,
  ],
  controllers: [VouchersController],
  providers: [VouchersService, VouchersRepository],
  exports: [VouchersService],
})
export class VouchersModule {}
