import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "../../shared/base/repository.base";
import { SubcategoryDocument } from "../schemas/subcategory.schema";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";

@Injectable()
export class SubcategoriesRepository extends BaseRepository<SubcategoryDocument> {
  constructor(
    @InjectModel(DBCollectionNames.SUBCATEGORIES)
    private readonly _Model: Model<SubcategoryDocument>,
  ) {
    super(_Model);
  }
}
