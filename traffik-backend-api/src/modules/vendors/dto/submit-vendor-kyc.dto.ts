import { ApiProperty } from "@nestjs/swagger";

export class SubmitVendorKycDto {
  @ApiProperty({ example: "First Bank" })
  bankName: string;

  @ApiProperty({ example: "0123456789" })
  accountNumber: string;

  @ApiProperty({ example: "1990-01-01" })
  dob: string;

  @ApiProperty({ example: "22222222222" })
  bvn: string;
}

export class UpdateKycStatusDto {
  @ApiProperty({ enum: ["approved", "rejected"] })
  status: string;

  @ApiProperty({ required: false })
  notes?: string;
}
