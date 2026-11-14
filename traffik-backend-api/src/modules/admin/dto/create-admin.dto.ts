import { ApiProperty } from "@nestjs/swagger";

export class CreateAdminDto {
  @ApiProperty({
    description: "Admin's first name",
    example: "John",
  })
  firstName: string;

  @ApiProperty({
    description: "Admin's last name",
    example: "Doe",
  })
  lastName: string;

  @ApiProperty({
    description: "Admin's email address",
    example: "john.doe@example.com",
  })
  email: string;

  @ApiProperty({
    description: "Admin's password",
    example: "StrongP@ssw0rd",
  })
  password: string;
}
