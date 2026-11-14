import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CategoriesController } from "./controllers/categories.controller";
import { CategoriesService } from "./services/categories.service";
import { CategoriesRepository } from "./repositories/categories.repository";
import { CategorySchema } from "./schemas/category.schema";
import { SubcategorySchema } from "./schemas/subcategory.schema";
import { SubcategoriesRepository } from "./repositories/subcategories.repository";
import { DBCollectionNames } from "../shared/enums/db_collections_name.enum";
import { SharedModule } from "../shared/shared.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DBCollectionNames.CATEGORIES, schema: CategorySchema },
      { name: DBCollectionNames.SUBCATEGORIES, schema: SubcategorySchema },
    ]),
    SharedModule,
  ],
  controllers: [CategoriesController],
  providers: [
    CategoriesService,
    CategoriesRepository,
    SubcategoriesRepository,
  ],
  exports: [
    CategoriesService,
    CategoriesRepository,
    SubcategoriesRepository,
  ],
})
export class CategoriesModule {}
