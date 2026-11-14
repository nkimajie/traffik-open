import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AddressesController } from "./controllers/addresses.controller";
import { AddressesService } from "./services/addresses.service";
import { AddressesRepository } from "./repositories/addresses.repository";
import { Address, AddressSchema } from "./schemas/address.schema";
import { SharedModule } from "src/modules/shared/shared.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Address.name, schema: AddressSchema }]),
    SharedModule,
  ],
  controllers: [AddressesController],
  providers: [AddressesService, AddressesRepository],
  exports: [AddressesService],
})
export class AddressesModule {}
