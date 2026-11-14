import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "../../shared/base/repository.base";
import { AdminDocument } from "../schemas/admin.schema";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";

@Injectable()
export class AdminRepository extends BaseRepository<AdminDocument> {
  constructor(
    @InjectModel(DBCollectionNames.ADMINS)
    private readonly _Model: Model<AdminDocument>,
  ) {
    super(_Model);
  }
}
