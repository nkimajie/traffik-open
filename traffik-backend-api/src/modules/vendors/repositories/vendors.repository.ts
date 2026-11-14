import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "src/modules/shared/base/repository.base";
import { VendorDocument } from "../schemas/vendor.schema";
import { DBCollectionNames } from "src/modules/shared/enums/db_collections_name.enum";

@Injectable()
export class VendorsRepository extends BaseRepository<VendorDocument> {
  constructor(
    @InjectModel(DBCollectionNames.VENDORS)
    private readonly _Model: Model<VendorDocument>,
  ) {
    super(_Model);
  }
}
