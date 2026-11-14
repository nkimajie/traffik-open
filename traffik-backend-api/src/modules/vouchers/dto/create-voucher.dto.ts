import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateVoucherDto {
  @ApiProperty({
    description: "Voucher name",
    minLength: 2,
    maxLength: 100,
    example: "Summer Sale 2024",
  })
  @IsNotEmpty({ message: "Voucher name is required" })
  @IsString({ message: "Voucher name must be a string" })
  @MinLength(2, { message: "Voucher name must be at least 2 characters long" })
  @MaxLength(100, {
    message: "Voucher name cannot exceed 100 characters",
  })
  name: string;

  @ApiProperty({
    description: "Voucher code (will be converted to uppercase)",
    minLength: 3,
    maxLength: 20,
    example: "SUMMER2024",
  })
  @IsNotEmpty({ message: "Voucher code is required" })
  @IsString({ message: "Voucher code must be a string" })
  @MinLength(3, { message: "Voucher code must be at least 3 characters long" })
  @MaxLength(20, {
    message: "Voucher code cannot exceed 20 characters",
  })
  code: string;

  @ApiProperty({
    description: "Discount percentage (0-100)",
    minimum: 0,
    maximum: 100,
    example: 20,
  })
  @IsNotEmpty({ message: "Percentage is required" })
  @IsNumber({}, { message: "Percentage must be a number" })
  @Min(0, { message: "Percentage must be at least 0" })
  @Max(100, { message: "Percentage cannot exceed 100" })
  percentage: number;

  @ApiProperty({
    description: "Voucher expiration date",
    example: "2024-12-31T23:59:59.000Z",
  })
  @IsNotEmpty({ message: "Expiring date is required" })
  expiringDate: Date;
}
