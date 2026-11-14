import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "src/modules/users/enums/user-role.enum";

class PhoneDto {
  @ApiProperty({ example: "+234", description: "Country code with + prefix" })
  @IsNotEmpty()
  @IsString()
  countryCode: string;

  @ApiProperty({
    example: "8012345678",
    description: "Phone number without country code",
  })
  @IsNotEmpty()
  @IsString()
  number: string;
}

export class SignupDto {
  @ApiProperty({ example: "John" })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: "Doe" })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty({ example: "john@example.com" })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: "password123", minLength: 8 })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.USER,
    description:
      "Account type to create. `user` for a shopper, `vendor` for a store owner.",
  })
  @IsNotEmpty()
  @IsString()
  role: UserRole;

  // @ApiProperty({ example: "NG", description: "2-letter country ISO code" })
  // @IsNotEmpty()
  // @IsString()
  // @Matches(/^[A-Z]{2}$/, { message: "Invalid country ISO code format" })
  // countryISOCode: string;

  @ApiProperty({ type: PhoneDto })
  @IsNotEmpty()
  phone: PhoneDto;
}
