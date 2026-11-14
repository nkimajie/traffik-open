import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CartsController } from "./controllers/carts.controller";
import { CartsService } from "./services/carts.service";
import { CartsRepository } from "./repositories/carts.repository";
import { Cart, CartSchema } from "./schemas/cart.schema";
import { ProductsModule } from "../products/products.module";
import { VouchersModule } from "../vouchers/vouchers.module";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cart.name, schema: CartSchema }]),
    forwardRef(() => ProductsModule),
    VouchersModule,
  ],
  controllers: [CartsController],
  providers: [CartsService, CartsRepository, UtilsService],
  exports: [CartsService],
})
export class CartsModule {}
