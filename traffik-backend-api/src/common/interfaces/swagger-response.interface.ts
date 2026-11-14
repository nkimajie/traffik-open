import { ApiProperty } from "@nestjs/swagger";

export class SwaggerApiResponseDto<T = any> {
  @ApiProperty({ example: 200 })
  status: number;

  @ApiProperty({ example: "Success" })
  message: string;

  @ApiProperty({ required: false })
  data?: T;

  @ApiProperty({ required: false })
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: any;
  };
}
