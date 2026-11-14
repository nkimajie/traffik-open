import { Injectable, Logger } from "@nestjs/common";
import { FileUploadsRepository } from "../repositories/file-uploads.repository";
import { CloudinaryService } from "./cloudinary.service";
import { FileUpload } from "../schemas/file-upload.schema";
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly fileUploadsRepository: FileUploadsRepository,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    resourceType: "image" | "video" | "raw" | "auto" = "auto",
  ): Promise<FileUpload> {
    try {
      // Determine actual resource type if "auto" is provided
      const actualType =
        resourceType === "auto"
          ? this.getResourceTypeFromMimetype(file.mimetype)
          : resourceType;

      // Upload to Cloudinary using the appropriate method
      let uploadResult;
      const folder = `users/${userId}`;

      if (actualType === "image") {
        uploadResult = await this.cloudinaryService.uploadUserImage(
          file,
          userId,
        );
      } else if (actualType === "video") {
        uploadResult = await this.cloudinaryService.uploadVideo(file, folder);
      } else {
        uploadResult = await this.cloudinaryService.uploadDocument(
          file,
          folder,
        );
      }

      // Save to database
      const fileUpload = await this.fileUploadsRepository.create({
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        userId,
        inUse: false,
      });

      return fileUpload;
    } catch (error: any) {
      this.logger.error(
        `Error uploading file: ${error?.message || JSON.stringify(error)}`,
        error?.stack || error,
      );
      throw error instanceof Error ? error : new Error("File upload failed");
    }
  }

  /**
   * Uploads multiple files using the same pipeline as {@link uploadFile}.
   * Returns successful uploads; per-file failures are listed in `errors` without failing the whole batch.
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    userId: string,
    resourceType: "image" | "video" | "raw" | "auto" = "auto",
  ): Promise<{
    uploaded: FileUpload[];
    errors: { index: number; originalname: string; message: string }[];
  }> {
    if (!files?.length) {
      return { uploaded: [], errors: [] };
    }

    const uploaded: FileUpload[] = [];
    const errors: { index: number; originalname: string; message: string }[] =
      [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const record = await this.uploadFile(file, userId, resourceType);
        uploaded.push(record);
      } catch (err: any) {
        errors.push({
          index: i,
          originalname: file?.originalname ?? `file-${i}`,
          message: err?.message ?? "Upload failed",
        });
      }
    }

    return { uploaded, errors };
  }

  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      const file = await this.fileUploadsRepository.query({
        _id: fileId,
        userId,
      });

      if (!file) {
        return false;
      }

      // Delete from Cloudinary
      await this.cloudinaryService.deleteFile(file.publicId);

      // Delete from database
      await this.fileUploadsRepository.delete({ _id: fileId });

      return true;
    } catch (error: any) {
      this.logger.error(`Error deleting file: ${error.message}`);
      throw error;
    }
  }

  async deleteFileByPublicId(
    publicId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const file = await this.fileUploadsRepository.query({
        publicId,
        userId,
      });

      if (!file) {
        return false;
      }

      // Delete from Cloudinary
      await this.cloudinaryService.deleteFile(file.publicId);

      // Delete from database
      await this.fileUploadsRepository.delete({ _id: file._id });

      return true;
    } catch (error: any) {
      this.logger.error(`Error deleting file by publicId: ${error?.message}`);
      throw error;
    }
  }

  async markFileAsUnused(publicId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.fileUploadsRepository.updateOne(
        { publicId, userId },
        { inUse: false },
      );
      return !!result;
    } catch (error: any) {
      this.logger.error(`Error marking file as unused: ${error.message}`);
      throw error;
    }
  }

  async markFileAsInUse(publicId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.fileUploadsRepository.updateOne(
        { publicId, userId },
        { inUse: true },
      );
      return !!result;
    } catch (error: any) {
      this.logger.error(`Error marking file as in use: ${error.message}`);
      throw error;
    }
  }

  async cleanupUnusedFiles() {
    try {
      // Find all unused files
      const unusedFiles = await this.fileUploadsRepository.queryAll({
        inUse: false,
      });

      for (const file of unusedFiles.items) {
        try {
          // Delete from Cloudinary
          await this.cloudinaryService.deleteFile(file.publicId);

          // Delete from database
          await this.fileUploadsRepository.delete({ _id: file._id });

          this.logger.log(`Cleaned up file: ${file.publicId}`);
        } catch (error: any) {
          this.logger.error(
            `Error cleaning up file ${file.publicId}: ${error.message}`,
          );
        }
      }
    } catch (error: any) {
      this.logger.error(`Error in cleanup job: ${error.message}`);
      throw error;
    }
  }
  private getResourceTypeFromMimetype(
    mimetype: string,
  ): "image" | "video" | "raw" {
    if (mimetype?.startsWith("image/")) {
      return "image";
    }
    if (mimetype?.startsWith("video/") || mimetype?.startsWith("audio/")) {
      return "video";
    }
    return "raw";
  }
}
