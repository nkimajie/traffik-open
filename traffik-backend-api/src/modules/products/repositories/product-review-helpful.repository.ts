import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "src/modules/shared/base/repository.base";
import { DBCollectionNames } from "src/modules/shared/enums/db_collections_name.enum";
import { ProductReviewHelpfulVoteDocument } from "../schemas/product-review-helpful.schema";

@Injectable()
export class ProductReviewHelpfulRepository extends BaseRepository<ProductReviewHelpfulVoteDocument> {
  constructor(
    @InjectModel(DBCollectionNames.PRODUCT_REVIEW_HELPFUL)
    private readonly helpfulModel: Model<ProductReviewHelpfulVoteDocument>,
  ) {
    super(helpfulModel);
  }
}
