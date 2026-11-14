import { ApiProperty } from "@nestjs/swagger";
import { OrderStatus } from "../enums/order.enum";

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PROCESSING })
  status: OrderStatus;

  @ApiProperty({ example: "Order is now being processed" })
  description: string;
}
