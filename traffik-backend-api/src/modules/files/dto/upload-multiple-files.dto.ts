import { ApiProperty } from "@nestjs/swagger";

export class UploadMultipleFilesDto {
  @ApiProperty({
    type: "array",
    items: { type: "string", format: "binary" },
    description: "Files to upload (same field name repeated in multipart)",
  })
  files: Express.Multer.File[];
}
