import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProductsController } from "./controllers/products.controller";
import { ProductReviewsController } from "./controllers/product-reviews.controller";
import { ProductsService } from "./services/products.service";
import { ProductReviewsService } from "./services/product-reviews.service";
import { ProductsRepository } from "./repositories/products.repository";
import { ProductReviewsRepository } from "./repositories/product-reviews.repository";
import { ProductReviewHelpfulRepository } from "./repositories/product-review-helpful.repository";
import { ProductSchema } from "./schemas/product.schema";
import { ProductReviewSchema } from "./schemas/product-review.schema";
import { ProductReviewHelpfulVoteSchema } from "./schemas/product-review-helpful.schema";
import { DBCollectionNames } from "../shared/enums/db_collections_name.enum";
import { CategoriesModule } from "../categories/categories.module";
import { SharedModule } from "../shared/shared.module";
import { FilesModule } from "../files/files.module";
import { OrdersModule } from "../orders/orders.module";
import { UsersModule } from "../users/users.module";
import { VendorsModule } from "../vendors/vendors.module";
import { UsersFavouriteProductSchema } from "../shared/schemas/users_favourite_product.schema";
import { UsersFavouriteProductRepository } from "../shared/repositories/users-favourite-product.repository";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DBCollectionNames.PRODUCTS, schema: ProductSchema },
      {
        name: DBCollectionNames.USERS_FAVORITE_PRODUCTS,
        schema: UsersFavouriteProductSchema,
      },
      { name: DBCollectionNames.PRODUCT_REVIEWS, schema: ProductReviewSchema },
      {
        name: DBCollectionNames.PRODUCT_REVIEW_HELPFUL,
        schema: ProductReviewHelpfulVoteSchema,
      },
    ]),
    CategoriesModule,
    SharedModule,
    FilesModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => UsersModule),
    forwardRef(() => VendorsModule),
  ],
  controllers: [ProductsController, ProductReviewsController],
  providers: [
    ProductsService,
    ProductReviewsService,
    ProductsRepository,
    ProductReviewsRepository,
    ProductReviewHelpfulRepository,
    UsersFavouriteProductRepository,
  ],
  exports: [ProductsService, ProductsRepository],
})
export class ProductsModule {}
