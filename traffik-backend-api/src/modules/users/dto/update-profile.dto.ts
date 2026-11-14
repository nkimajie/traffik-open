import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

class PhoneDto {
  @ApiProperty({ example: "8123456789" })
  @IsString()
  number: string;

  @ApiProperty({ example: "+234" })
  @IsString()
  countryCode: string;
}

export class UpdateProfileDto {
  @ApiProperty({ example: "John", required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: "Doe", required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ type: PhoneDto, required: false })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PhoneDto)
  phone?: PhoneDto;

  @ApiProperty({
    type: "string",
    format: "binary",
    required: false,
    description: "Profile picture file",
  })
  @IsOptional()
  profilePicture?: any;
}
