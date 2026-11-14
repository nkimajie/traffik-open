import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "../base/repository.base";
import { DBCollectionNames } from "../enums/db_collections_name.enum";
import { UsersFavouriteProductDocument } from "../schemas/users_favourite_product.schema";

@Injectable()
export class UsersFavouriteProductRepository extends BaseRepository<UsersFavouriteProductDocument> {
  constructor(
    @InjectModel(DBCollectionNames.USERS_FAVORITE_PRODUCTS)
    model: Model<UsersFavouriteProductDocument>,
  ) {
    super(model);
  }
}
