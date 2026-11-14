import { IsArray, ArrayMinSize, Validate } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { AVAILABLE_INTERESTS } from "../constants/interests.constant";

class IsValidInterestConstraint {
  validate(value: string) {
    return AVAILABLE_INTERESTS.includes(value as any);
  }

  defaultMessage() {
    return (
      "Invalid interest. Must be one of: " + AVAILABLE_INTERESTS.join(", ")
    );
  }
}

export class UpdateInterestsDto {
  @ApiProperty({
    description: "Array of user interests",
    example: ["Clothing", "Shoes"],
    type: [String],
    enum: AVAILABLE_INTERESTS,
  })
  @IsArray()
  @ArrayMinSize(1, { message: "At least one interest must be selected" })
  @Validate(IsValidInterestConstraint, { each: true })
  interests: string[];
}
