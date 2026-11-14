import { ApiProperty } from "@nestjs/swagger";
import { DeliveryMethod } from "../enums/order.enum";

export class CheckoutPreviewDto {
  @ApiProperty({ example: "60f7b3b3b3b3b3b3b3b3b3b3" })
  addressId: string;

  @ApiProperty({ enum: DeliveryMethod, example: DeliveryMethod.PICKUP_STATION })
  deliveryMethod: DeliveryMethod;
}

export class CreateOrderDto extends CheckoutPreviewDto {}
