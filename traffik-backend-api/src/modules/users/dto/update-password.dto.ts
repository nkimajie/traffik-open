import { ApiProperty } from "@nestjs/swagger";

/** Validation rules are enforced in {@link UsersService.updatePassword}. */
export class UpdatePasswordDto {
  @ApiProperty({
    example: "oldPassword123",
    description: "Current password of the user",
  })
  oldPassword: string;

  @ApiProperty({
    example: "NewPassword123!",
    description:
      "Min 8 chars; uppercase, lowercase, number, special (@$!%*?&.)",
  })
  newPassword: string;

  @ApiProperty({
    example: "NewPassword123!",
    description: "Must match newPassword",
  })
  confirmPassword: string;
}
