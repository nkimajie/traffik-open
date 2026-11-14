import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { BaseRepository } from "../../shared/base/repository.base";
import { FileUploadDocument } from "../schemas/file-upload.schema";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";

@Injectable()
export class FileUploadsRepository extends BaseRepository<FileUploadDocument> {
  constructor(
    @InjectModel(DBCollectionNames.FILE_UPLOADS)
    private readonly _Model: Model<FileUploadDocument>,
  ) {
    super(_Model);
  }
}
