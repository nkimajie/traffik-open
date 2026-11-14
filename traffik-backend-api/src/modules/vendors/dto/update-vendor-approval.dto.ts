import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateVendorApprovalDto {
  @ApiProperty({
    enum: ["approved", "rejected"],
    example: "approved",
    description:
      "Final store decision. `approved` sets `isApproved: true` on the vendor and unlocks product listing; `rejected` keeps the store unapproved.",
  })
  status: "approved" | "rejected";

  @ApiPropertyOptional({
    example: "Business address could not be verified.",
    description:
      "Optional note stored with the decision. Include a reason when rejecting so the vendor knows what to fix.",
  })
  notes?: string;
}
