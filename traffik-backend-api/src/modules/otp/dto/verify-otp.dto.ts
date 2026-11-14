import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class VerifyOtpDto {
  @ApiProperty({
    example: "5358",
    minLength: 4,
    maxLength: 4,
    description:
      "Four-digit one-time password emailed to the account. " +
      "Obtain a code via `POST /otp/resend` (vendors request explicitly during onboarding; shoppers may receive one automatically at signup). " +
      "Codes expire after one hour.",
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}
