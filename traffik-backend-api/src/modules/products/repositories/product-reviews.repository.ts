import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "src/modules/shared/base/repository.base";
import { DBCollectionNames } from "src/modules/shared/enums/db_collections_name.enum";
import { ProductReviewDocument } from "../schemas/product-review.schema";

@Injectable()
export class ProductReviewsRepository extends BaseRepository<ProductReviewDocument> {
  constructor(
    @InjectModel(DBCollectionNames.PRODUCT_REVIEWS)
    private readonly reviewModel: Model<ProductReviewDocument>,
  ) {
    super(reviewModel);
  }
}
