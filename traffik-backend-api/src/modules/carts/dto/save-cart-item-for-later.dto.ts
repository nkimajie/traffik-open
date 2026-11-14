import { ApiProperty } from "@nestjs/swagger";
import { IsMongoId } from "class-validator";

export class SaveCartItemForLaterDto {
  @ApiProperty({
    description:
      "The product to save instead of adding to the cart, used when the cart already belongs to a different store.",
    example: "60f7b3b3b3b3b3b3b3b3b3b3",
  })
  @IsMongoId()
  productId: string;
}
