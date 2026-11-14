import { IsEmail, IsEnum, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "../../users/enums/user-role.enum";

export class LoginDto {
  @ApiProperty({ example: "john@example.com" })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: "password123" })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.USER,
    description:
      "Which account type to authenticate. Send `user` from the shopper apps and `vendor` from the vendor portal.",
  })
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}
