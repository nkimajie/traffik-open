import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { FileUploadSchema } from "./schemas/file-upload.schema";
import { FilesService } from "./services/files.service";
import { CloudinaryService } from "./services/cloudinary.service";
import { FileUploadsRepository } from "./repositories/file-uploads.repository";
import { DBCollectionNames } from "../shared/enums/db_collections_name.enum";
import { FilesController } from "./controllers/files.controller";

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      {
        name: DBCollectionNames.FILE_UPLOADS,
        schema: FileUploadSchema,
      },
    ]),
  ],
  controllers: [FilesController],
  providers: [FilesService, CloudinaryService, FileUploadsRepository],
  exports: [FilesService, FileUploadsRepository],
})
export class FilesModule {}
