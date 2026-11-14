import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "../../shared/base/repository.base";
import { VoucherDocument } from "../schemas/voucher.schema";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";

@Injectable()
export class VouchersRepository extends BaseRepository<VoucherDocument> {
  constructor(
    @InjectModel(DBCollectionNames.VOUCHERS)
    private readonly _Model: Model<VoucherDocument>,
  ) {
    super(_Model);
  }
}
