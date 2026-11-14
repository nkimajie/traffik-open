import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "src/modules/shared/base/repository.base";
import { Address, AddressDocument } from "../schemas/address.schema";

@Injectable()
export class AddressesRepository extends BaseRepository<AddressDocument> {
  constructor(
    @InjectModel(Address.name) private addressModel: Model<AddressDocument>,
  ) {
    super(addressModel);
  }
}
