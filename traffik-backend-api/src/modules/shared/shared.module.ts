import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UtilsService } from "./services/utils/utils.service";
import { PhoneNumberService } from "./services/phone-number/phone-number.service";
import { FileService } from "./services/file/file.service";
import { EmailService } from "./services/email/email.service";
import { TransactionsService } from "./services/transactions/transactions.service";
import { DBCollectionNames } from "./enums/db_collections_name.enum";
import { UsersFavouriteProductSchema } from "./schemas/users_favourite_product.schema";
import { UsersFavouriteStoreSchema } from "./schemas/users_favourite_store.schema";
import { UsersFavouriteProductRepository } from "./repositories/users-favourite-product.repository";
import { UsersFavouriteStoreRepository } from "./repositories/users-favourite-store.repository";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: DBCollectionNames.USERS_FAVORITE_PRODUCTS,
        schema: UsersFavouriteProductSchema,
      },
      {
        name: DBCollectionNames.USERS_FAVORITE_STORES,
        schema: UsersFavouriteStoreSchema,
      },
    ]),
  ],
  providers: [
    UtilsService,
    PhoneNumberService,
    FileService,
    EmailService,
    TransactionsService,
    UsersFavouriteProductRepository,
    UsersFavouriteStoreRepository,
  ],
  exports: [
    UtilsService,
    PhoneNumberService,
    FileService,
    EmailService,
    TransactionsService,
    UsersFavouriteProductRepository,
    UsersFavouriteStoreRepository,
  ],
})
export class SharedModule {}
