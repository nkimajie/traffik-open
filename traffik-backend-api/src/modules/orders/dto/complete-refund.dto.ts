import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { OrderRefundPayoutMethod } from "../enums/order-refund.enum";

export class CompleteOrderRefundDto {
  @ApiProperty({
    enum: OrderRefundPayoutMethod,
    example: OrderRefundPayoutMethod.BANK_TRANSFER,
    description: "How the money was returned.",
  })
  method: OrderRefundPayoutMethod;

  @ApiProperty({
    example: "FT26315XYZ",
    description:
      "Reference of the payout (bank transfer or Kashia refund reference). Sent to the shopper, and can back only one refund.",
  })
  reference: string;

  @ApiProperty({
    example: 2000,
    description:
      "Amount returned, in naira. Must equal the refund amount, as a check the right refund is being closed.",
  })
  amount: number;

  @ApiPropertyOptional({
    example: "Refunded to the account you paid from.",
    description: "Shown to the shopper.",
  })
  note?: string;
}

export class ReopenOrderRefundDto {
  @ApiProperty({
    example: "Marked by mistake: transfer FT26315XYZ was for another order",
    description:
      "Why the refund is going back into the queue. Kept in its history.",
  })
  reason: string;
}

export class ResolvePaymentAlertDto {
  @ApiProperty({
    example: "Recovered the duplicate payment from the store's next payout",
    description: "How the alert was dealt with. Kept on the order.",
  })
  note: string;
}
