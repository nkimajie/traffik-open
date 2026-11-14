import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNumber, Max, Min } from "class-validator";
import { ProductDiscountType } from "../enums/product-discount-type.enum";

export class ProductDiscountDto {
  @ApiProperty({
    example: 10,
    description: "Fixed: amount off. Percentage: 0–100 off list price.",
  })
  @IsNumber({}, { message: "amount must be a number" })
  @Min(0, { message: "amount cannot be negative" })
  @Max(1000000, { message: "amount cannot exceed 1,000,000" })
  amount: number;

  @ApiProperty({
    enum: ProductDiscountType,
    example: ProductDiscountType.PERCENTAGE,
  })
  @IsEnum(ProductDiscountType, { message: "type must be fixed or percentage" })
  type: ProductDiscountType;
}
