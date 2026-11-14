// import { Injectable, Logger } from "@nestjs/common";
// import { ConfigService } from "@nestjs/config";
// import { v2 as cloudinary } from "cloudinary";

// export interface UploadResult {
//   url: string;
//   publicId: string;
// }

// interface CloudinaryUploadResult {
//   secure_url: string;
//   public_id: string;
// }

// @Injectable()
// export class CloudinaryService {
//   private readonly logger = new Logger(CloudinaryService.name);

//   constructor(private configService: ConfigService) {
//     const cloud_name = this.configService.get<string>("CLOUDINARY_CLOUD_NAME");
//     const api_key = this.configService.get<string>("CLOUDINARY_API_KEY");
//     const api_secret = this.configService.get<string>("CLOUDINARY_API_SECRET");

//     this.logger.log(`Initializing Cloudinary with:
//       cloud_name: ${cloud_name}
//       api_key: ${api_key ? "PRESENT" : "MISSING"}
//       api_secret: ${api_secret ? "PRESENT" : "MISSING"}`);

//     this.logger.log(`NODE_ENV is: ${process.env.NODE_ENV}`);

//     cloudinary.config({
//       cloud_name,
//       api_key,
//       api_secret,
//     });
//   }

//   async uploadFile(
//     file: Express.Multer.File,
//     userId: string,
//     resourceType: "image" | "auto" = "auto",
//   ): Promise<UploadResult> {
//     try {
//       if (!file) {
//         throw new Error("Missing required parameter - file");
//       }

//       if (!file.buffer || file.buffer.length === 0) {
//         throw new Error("File buffer is empty or invalid");
//       }

//       // Validate file buffer size (safety check for AWS Lambda)
//       const maxBufferSize = 10 * 1024 * 1024; // 10MB
//       if (file.buffer.length > maxBufferSize) {
//         throw new Error("File size exceeds maximum allowed size");
//       }

//       const uploadOptions: any = {
//         folder: `users/${userId}`,
//         resource_type: resourceType,
//       };

//       // For images, ensure proper format handling
//       if (resourceType === "image" && file.mimetype) {
//         const format = file.mimetype.split("/")[1];
//         if (format) {
//           // Cloudinary uses 'jpg' not 'jpeg'
//           uploadOptions.format = format === "jpeg" ? "jpg" : format;
//         }
//       }

//       const result = await new Promise<CloudinaryUploadResult>(
//         (resolve, reject) => {
//           // Set timeout for AWS Lambda (30 seconds max)
//           const timeout = setTimeout(() => {
//             reject(new Error("Upload timeout - file upload took too long"));
//           }, 25000); // 25 seconds to allow Lambda to respond

//           const uploadStream = cloudinary.uploader.upload_stream(
//             uploadOptions,
//             (error, result) => {
//               clearTimeout(timeout);
//               if (error) {
//                 this.logger.error(
//                   `Cloudinary upload error: ${error.message}`,
//                   error,
//                 );
//                 reject(
//                   new Error(
//                     `Failed to upload file to Cloudinary: ${error.message}`,
//                   ),
//                 );
//               } else if (!result) {
//                 reject(new Error("Cloudinary returned no result"));
//               } else {
//                 resolve(result as CloudinaryUploadResult);
//               }
//             },
//           );

//           uploadStream.on("error", (error) => {
//             clearTimeout(timeout);
//             this.logger.error(`Upload stream error: ${error.message}`, error);
//             reject(new Error(`Upload stream failed: ${error.message}`));
//           });

//           uploadStream.end(file.buffer);
//         },
//       );

//       if (!result.secure_url || !result.public_id) {
//         throw new Error("Invalid response from Cloudinary");
//       }

//       return {
//         url: result.secure_url,
//         publicId: result.public_id,
//       };
//     } catch (error: any) {
//       this.logger.error(
//         `Error uploading file to Cloudinary: ${error?.message || JSON.stringify(error)}`,
//         error?.stack || error,
//       );
//       throw error instanceof Error
//         ? error
//         : new Error("File upload failed. Please try again.");
//     }
//   }

//   async deleteFile(publicId: string): Promise<any> {
//     try {
//       const result = await cloudinary.uploader.destroy(publicId);
//       return result;
//     } catch (error: any) {
//       this.logger.error(
//         `Error deleting file from Cloudinary: ${error.message}`,
//       );
//       throw error;
//     }
//   }
// }
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

export interface UploadResult {
  url: string;
  publicId: string;
}

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private configService: ConfigService) {
    const cloud_name = this.configService.get<string>("CLOUDINARY_CLOUD_NAME");
    const api_key = this.configService.get<string>("CLOUDINARY_API_KEY");
    const api_secret = this.configService.get<string>("CLOUDINARY_API_SECRET");

    this.logger.log(`Initializing Cloudinary with:
      cloud_name: ${cloud_name}
      api_key: ${api_key ? "PRESENT" : "MISSING"}
      api_secret: ${api_secret ? "PRESENT" : "MISSING"}`);

    this.logger.log(`NODE_ENV is: ${process.env.NODE_ENV}`);

    cloudinary.config({
      cloud_name,
      api_key,
      api_secret,
    });
  }

  /**
   * Upload user profile image
   */
  async uploadUserImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResult> {
    return this.uploadToCloudinary(file, `users/${userId}`, "image");
  }

  /**
   * Upload video
   */
  async uploadVideo(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResult> {
    return this.uploadToCloudinary(file, folder, "video");
  }

  /**
   * Upload document / generic file
   */
  async uploadDocument(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResult> {
    return this.uploadToCloudinary(file, folder, "raw");
  }

  /**
   * Core uploader used internally
   */
  private async uploadToCloudinary(
    file: Express.Multer.File,
    folder: string,
    resourceType: "image" | "video" | "raw",
  ): Promise<UploadResult> {
    try {
      if (!file) {
        throw new Error("Missing required parameter - file");
      }

      if (!file.buffer || file.buffer.length === 0) {
        throw new Error("File buffer is empty or invalid");
      }

      // Validate file buffer size (safety check for AWS Lambda)
      const maxBufferSize = 10 * 1024 * 1024;
      if (file.buffer.length > maxBufferSize) {
        throw new Error("File size exceeds maximum allowed size");
      }

      const uploadOptions: any = {
        folder,
        resource_type: resourceType,
      };

      // For images, ensure proper format handling
      if (resourceType === "image" && file.mimetype) {
        const format = file.mimetype.split("/")[1];
        if (format) {
          uploadOptions.format = format === "jpeg" ? "jpg" : format;
        }
      }

      const result = await new Promise<CloudinaryUploadResult>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Upload timeout - file upload took too long"));
          }, 25000);

          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              clearTimeout(timeout);

              if (error) {
                this.logger.error(
                  `Cloudinary upload error: ${error.message}`,
                  error,
                );

                reject(
                  new Error(
                    `Failed to upload file to Cloudinary: ${error.message}`,
                  ),
                );
              } else if (!result) {
                reject(new Error("Cloudinary returned no result"));
              } else {
                resolve(result as CloudinaryUploadResult);
              }
            },
          );

          uploadStream.on("error", (error) => {
            clearTimeout(timeout);

            this.logger.error(`Upload stream error: ${error.message}`, error);

            reject(new Error(`Upload stream failed: ${error.message}`));
          });

          // In Serverless environments, stream the buffer in chunks to avoid overwhelming memory/TCP limits at once
          Readable.from(file.buffer).pipe(uploadStream);
        },
      );

      if (!result.secure_url || !result.public_id) {
        throw new Error("Invalid response from Cloudinary");
      }

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error: any) {
      this.logger.error(
        `Error uploading file to Cloudinary: ${
          error?.message || JSON.stringify(error)
        }`,
        error?.stack || error,
      );

      throw error instanceof Error
        ? error
        : new Error("File upload failed. Please try again.");
    }
  }

  async deleteFile(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error: any) {
      this.logger.error(
        `Error deleting file from Cloudinary: ${error.message}`,
      );
      throw error;
    }
  }
}
