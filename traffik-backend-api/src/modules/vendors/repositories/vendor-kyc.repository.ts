import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";
import { BaseRepository } from "../../shared/base/repository.base";
import { VendorKyc, VendorKycDocument } from "../schemas/vendor-kyc.schema";

@Injectable()
export class VendorKycRepository extends BaseRepository<VendorKycDocument> {
  constructor(
    @InjectModel(DBCollectionNames.VENDOR_KYC)
    private readonly vendorKycModel: Model<VendorKycDocument>,
  ) {
    super(vendorKycModel);
  }
}
