import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

class PhoneDto {
  @ApiProperty({ example: "+234", description: "Country code with + prefix" })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,3}$/, { message: "Invalid country code format" })
  countryCode: string;

  @ApiProperty({
    example: "8012345678",
    description: "Phone number without country code",
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: "Invalid phone number format" })
  number: string;
}

export class CreateWaitlistDto {
  @ApiProperty({ example: "john@example.com" })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ type: PhoneDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => PhoneDto)
  phone: PhoneDto;
}
