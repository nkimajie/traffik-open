import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "../base/repository.base";
import { DBCollectionNames } from "../enums/db_collections_name.enum";
import { UsersFavouriteStoreDocument } from "../schemas/users_favourite_store.schema";

@Injectable()
export class UsersFavouriteStoreRepository extends BaseRepository<UsersFavouriteStoreDocument> {
  constructor(
    @InjectModel(DBCollectionNames.USERS_FAVORITE_STORES)
    model: Model<UsersFavouriteStoreDocument>,
  ) {
    super(model);
  }
}
