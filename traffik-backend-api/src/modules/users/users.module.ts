import { Module, forwardRef } from "@nestjs/common";
import { UsersController } from "./controllers/users.controller";
import { UsersService } from "./services/users.service";
import { MongooseModule } from "@nestjs/mongoose";
import { DBCollectionNames } from "../shared/enums/db_collections_name.enum";
import { UserSchema } from "./schemas/user.schema";
import { UsersRepository } from "./repositories/users.repository";
import { VendorsModule } from "../vendors/vendors.module";
import { ProductsModule } from "../products/products.module";
import { CategoriesModule } from "../categories/categories.module";
import { SharedModule } from "../shared/shared.module";

import { FilesModule } from "../files/files.module";

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersRepository, UsersService],
  imports: [
    MongooseModule.forFeature([
      {
        name: DBCollectionNames.USERS,
        schema: UserSchema,
        collection: DBCollectionNames.USERS,
      },
    ]),
    forwardRef(() => VendorsModule),
    forwardRef(() => ProductsModule),
    CategoriesModule,
    SharedModule,
    FilesModule,
  ],
})
export class UsersModule {}
