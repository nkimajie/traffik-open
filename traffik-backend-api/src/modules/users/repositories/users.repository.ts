import { BaseRepository } from "src/modules/shared/base/repository.base";
import { UserDocument } from "../schemas/user.schema";
import { DBCollectionNames } from "src/modules/shared/enums/db_collections_name.enum";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

export class UsersRepository extends BaseRepository<UserDocument> {
  constructor(
    @InjectModel(DBCollectionNames.USERS) private _Model: Model<UserDocument>,
  ) {
    super(_Model);
  }
}
