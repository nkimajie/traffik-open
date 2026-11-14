import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "src/modules/shared/base/repository.base";
import { DBCollectionNames } from "src/modules/shared/enums/db_collections_name.enum";
import { VendorLikeDocument } from "../schemas/vendor-like.schema";

@Injectable()
export class VendorLikesRepository extends BaseRepository<VendorLikeDocument> {
  constructor(
    @InjectModel(DBCollectionNames.VENDOR_LIKES)
    private readonly likeModel: Model<VendorLikeDocument>,
  ) {
    super(likeModel);
  }
}
