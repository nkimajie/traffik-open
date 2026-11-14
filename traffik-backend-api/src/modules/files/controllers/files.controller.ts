import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { FilesService } from "../services/files.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import RolesGuard from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { UserRole } from "../../users/enums/user-role.enum";
import { GetUser } from "../../../common/decorators/get-user.decorator";
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiResponse as ApiResponseDoc,
} from "@nestjs/swagger";
import {
  ApiAudience,
  ApiEndpoint,
} from "../../../common/decorators/api-audience.decorator";
import { UploadFileDto } from "../dto/upload-file.dto";
import { UploadMultipleFilesDto } from "../dto/upload-multiple-files.dto";

const MAX_FILES_PER_REQUEST = 3;
import { ApiResponse } from "../../../common/interfaces/response.interface";

@ApiTags("Files")
@Controller("files")
@UseGuards(JwtAuthGuard, RolesGuard([UserRole.USER, UserRole.VENDOR]))
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post("upload")
  @Roles(UserRole.USER, UserRole.VENDOR)
  @UseInterceptors(FileInterceptor("file"))
  @ApiEndpoint({
    audience: [ApiAudience.SHOPPER, ApiAudience.VENDOR],
    summary: "Upload one file",
    description:
      "Uploads a single file to Cloudinary and returns its id and public URL. Send it as `multipart/form-data` with the field name `file`. Vendors use this for product images, store logos, and KYC documents; shoppers use it for review photos. Reference the returned URL when creating the product or review.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UploadFileDto })
  @ApiResponseDoc({
    status: 201,
    description: "File uploaded; response contains the file id and URL",
  })
  @ApiResponseDoc({
    status: 400,
    description: "No file supplied, or the type or size was rejected",
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @GetUser("_id") userId: string,
  ): Promise<ApiResponse> {
    const data = await this.filesService.uploadFile(file, userId);
    return {
      status: HttpStatus.CREATED,
      message: "File uploaded successfully",
      data,
    };
  }

  @Post("upload/multiple")
  @Roles(UserRole.USER, UserRole.VENDOR)
  @UseInterceptors(FilesInterceptor("files", MAX_FILES_PER_REQUEST))
  @ApiEndpoint({
    audience: [ApiAudience.SHOPPER, ApiAudience.VENDOR],
    summary: "Upload up to three files",
    description: `Uploads several files in one request. Send each part under the field name \`files\`; at most ${MAX_FILES_PER_REQUEST} are accepted per request. The response reports successes in \`data.files\` and per-file failures in \`data.errors\`, so a partial success is possible.`,
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UploadMultipleFilesDto })
  @ApiResponseDoc({
    status: 201,
    description: "At least one file uploaded; check `data.errors` for failures",
  })
  @ApiResponseDoc({
    status: 400,
    description: "No files supplied, or every upload failed",
  })
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @GetUser("_id") userId: string,
  ): Promise<ApiResponse> {
    const list = files ?? [];
    if (list.length === 0) {
      throw new BadRequestException(
        "No files provided. Use form field name `files` for each part.",
      );
    }
    const { uploaded, errors } = await this.filesService.uploadMultipleFiles(
      list,
      userId,
    );
    const allFailed = uploaded.length === 0 && errors.length > 0;
    return {
      status: allFailed ? HttpStatus.BAD_REQUEST : HttpStatus.CREATED,
      message: allFailed
        ? "All file uploads failed"
        : errors.length
          ? `${uploaded.length} file(s) uploaded; ${errors.length} failed`
          : `${uploaded.length} file(s) uploaded successfully`,
      data: { files: uploaded, errors },
    };
  }

  @Delete(":fileId")
  @Roles(UserRole.USER, UserRole.VENDOR)
  @ApiEndpoint({
    audience: [ApiAudience.SHOPPER, ApiAudience.VENDOR],
    summary: "Delete an uploaded file",
    description:
      "Permanently removes a file the caller uploaded, from both Cloudinary and the file record. Files still referenced by a live product should be detached first.",
  })
  @ApiParam({ name: "fileId", description: "File ObjectId" })
  @ApiResponseDoc({ status: 200, description: "File deleted successfully" })
  @ApiResponseDoc({
    status: 404,
    description: "File not found or not owned by the caller",
  })
  async deleteFile(
    @Param("fileId") fileId: string,
    @GetUser("_id") userId: string,
  ): Promise<ApiResponse> {
    const success = await this.filesService.deleteFile(fileId, userId);
    return {
      status: success ? HttpStatus.OK : HttpStatus.NOT_FOUND,
      message: success ? "File deleted successfully" : "File not found",
    };
  }

  @Post(":fileId/mark-unused")
  @Roles(UserRole.USER, UserRole.VENDOR)
  @ApiEndpoint({
    audience: [ApiAudience.SHOPPER, ApiAudience.VENDOR],
    summary: "Mark a file as unused",
    description:
      "Flags a previously uploaded file as no longer referenced, so housekeeping can reclaim it. Call this when a client uploads an image and then abandons the form instead of deleting immediately.",
  })
  @ApiParam({ name: "fileId", description: "File ObjectId" })
  @ApiResponseDoc({ status: 200, description: "File marked as unused" })
  @ApiResponseDoc({
    status: 404,
    description: "File not found or not owned by the caller",
  })
  async markFileAsUnused(
    @Param("fileId") fileId: string,
    @GetUser("_id") userId: string,
  ): Promise<ApiResponse> {
    const success = await this.filesService.markFileAsUnused(fileId, userId);
    return {
      status: success ? HttpStatus.OK : HttpStatus.NOT_FOUND,
      message: success
        ? "File marked as unused successfully"
        : "File not found",
    };
  }
}
