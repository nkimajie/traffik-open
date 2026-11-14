import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, Types, UpdateQuery } from "mongoose";
import { BaseRepository } from "../../shared/base/repository.base";
import { ProductDocument } from "../schemas/product.schema";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";
import { ProductStockSnapshot } from "../interfaces/product-stock-edit.interface";

@Injectable()
export class ProductsRepository extends BaseRepository<ProductDocument> {
  constructor(
    @InjectModel(DBCollectionNames.PRODUCTS)
    private readonly _Model: Model<ProductDocument>,
  ) {
    super(_Model);
  }

  /** A vendor's product as stored, with just what stock edits are planned from. */
  async findVendorStockSnapshot(
    productId: Types.ObjectId,
    vendorId: Types.ObjectId,
  ): Promise<ProductStockSnapshot | null> {
    return this._Model
      .findOne({ _id: productId, vendorId })
      .select("hasVariations defaultVariation.quantity variations")
      .lean<ProductStockSnapshot>();
  }

  /**
   * Writes a vendor's product edit in one step, only while `guard` still
   * matches: the stock the edit was planned from has not been moved by an
   * order in the meantime. Returns null when it no longer matches (or the
   * product is not the vendor's), so the caller can read and plan again.
   *
   * Goes through the model directly: BaseRepository.update swallows errors
   * and re-reads by the same filter, which a guarded write no longer matches.
   */
  async applyVendorEdit(
    productId: Types.ObjectId,
    vendorId: Types.ObjectId,
    guard: FilterQuery<ProductDocument>,
    update: { set: Record<string, unknown>; unset: string[] },
  ): Promise<ProductDocument | null> {
    const changes: UpdateQuery<ProductDocument> = {};
    if (Object.keys(update.set).length > 0) {
      changes.$set = update.set;
    }
    if (update.unset.length > 0) {
      changes.$unset = Object.fromEntries(
        update.unset.map((path) => [path, ""]),
      );
    }

    return this._Model.findOneAndUpdate(
      { ...guard, _id: productId, vendorId },
      changes,
      { new: true },
    );
  }
}
