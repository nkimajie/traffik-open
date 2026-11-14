import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class BusinessHourSlotDto {
  @ApiProperty({ example: "monday" })
  @IsString()
  @IsNotEmpty()
  day: string;

  @ApiProperty({ example: "09:00" })
  @IsString()
  @IsNotEmpty()
  open: string;

  @ApiProperty({ example: "18:00" })
  @IsString()
  @IsNotEmpty()
  close: string;
}

export class CompleteVendorSignupDto {
  @ApiProperty({ example: "John's Coffee Shop" })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ example: "https://example.com/logo.png", required: false })
  @IsOptional()
  @IsString()
  storeLogo?: string;

  @ApiProperty({
    example: "https://example.com/cover.png",
    required: false,
  })
  @IsOptional()
  @IsString()
  storeCoverPhoto?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  @IsNotEmpty()
  physicalStore: boolean;

  @ApiProperty({ example: "123 Main St, City, Country", required: false })
  @ValidateIf((o) => o.physicalStore === true)
  @IsString()
  @IsNotEmpty()
  physicalStoreAddress?: string;

  @ApiProperty({ example: "business@example.com" })
  @IsEmail()
  @IsNotEmpty()
  businessEmail: string;

  @ApiProperty({ example: "+1234567890" })
  @IsString()
  @IsNotEmpty()
  businessPhone: string;

  @ApiProperty({ example: "https://example.com", required: false })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiProperty({
    example: "Premium coffee shop serving specialty brews",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: [BusinessHourSlotDto],
    required: false,
    example: [{ day: "monday", open: "09:00", close: "18:00" }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessHourSlotDto)
  businessHours?: BusinessHourSlotDto[];

  @ApiProperty({
    type: [String],
    example: ["6840b7c5c311a26b997da9d0"],
    description: "Category ObjectIds (1–5)",
  })
  @IsArray()
  @IsString({ each: true })
  businessCategories: string[];

  @ApiProperty({ example: "Fashion", required: false })
  @IsOptional()
  @IsString()
  businessCategory?: string;
}
