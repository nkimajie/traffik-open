import { ApiProperty } from "@nestjs/swagger";

export class PlatformSettingsDto {
  @ApiProperty({
    example: 0,
    minimum: 0,
    maximum: 20,
    description:
      "Marketplace commission percentage passed to Kashia as merchant_fee_percentage. 0 means no Traffik cut on checkout.",
  })
  commissionPercentage: number;

  @ApiProperty({ required: false })
  updatedAt?: Date;
}

export class UpdatePlatformSettingsDto {
  @ApiProperty({
    example: 10,
    minimum: 0,
    maximum: 20,
    description: "Marketplace commission percentage (0–20).",
  })
  commissionPercentage: number;
}
