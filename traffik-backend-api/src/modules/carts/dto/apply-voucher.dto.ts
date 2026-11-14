import { ApiProperty } from "@nestjs/swagger";

export class ApplyVoucherDto {
  @ApiProperty({ description: "The voucher code to apply", example: "SAVE20" })
  code: string;
}
