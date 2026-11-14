import { Module } from "@nestjs/common";
import { SearchController } from "./controllers/search.controller";
import { SearchService } from "./services/search.service";
import { ProductsModule } from "../products/products.module";
import { VendorsModule } from "../vendors/vendors.module";

@Module({
  imports: [ProductsModule, VendorsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class CatalogModule {}
