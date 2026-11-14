import { ApiProperty } from "@nestjs/swagger";
import { IsMongoId, IsNumber, IsOptional, Min } from "class-validator";

export class AddCartItemDto {
  @ApiProperty({
    description: "The ID of the product",
    example: "60f7b3b3b3b3b3b3b3b3b3b3",
  })
  @IsMongoId()
  productId: string;

  @ApiProperty({
    description:
      "ID of the product variation (variation subdocument _id) when product has variations. Omit for products without variations.",
    example: "60f7b3b3b3b3b3b3b3b3b3b4",
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  variationId?: string;

  @ApiProperty({
    description: "The quantity of the product to add",
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;
}
