import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "../../shared/base/repository.base";
import { CategoryDocument } from "../schemas/category.schema";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";

@Injectable()
export class CategoriesRepository extends BaseRepository<CategoryDocument> {
  constructor(
    @InjectModel(DBCollectionNames.CATEGORIES)
    private readonly _Model: Model<CategoryDocument>,
  ) {
    super(_Model);
  }
}
