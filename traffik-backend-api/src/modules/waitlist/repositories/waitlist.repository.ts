import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "../../shared/base/repository.base";
import { WaitlistDocument } from "../schemas/waitlist.schema";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";

@Injectable()
export class WaitlistRepository extends BaseRepository<WaitlistDocument> {
  constructor(
    @InjectModel(DBCollectionNames.WAITLIST)
    private _Model: Model<WaitlistDocument>,
  ) {
    super(_Model);
  }
}
