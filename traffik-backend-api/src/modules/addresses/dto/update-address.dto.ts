import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateAddressDto {
  @ApiPropertyOptional({ example: "John Doe" })
  fullName?: string;

  @ApiPropertyOptional({ example: "Lagos" })
  state?: string;

  @ApiPropertyOptional({ example: "Ikeja" })
  city?: string;

  @ApiPropertyOptional({ example: "1234 All balogun off gbagada road" })
  streetAddress?: string;

  @ApiPropertyOptional({ example: "Near the big tree" })
  landmark?: string;

  @ApiPropertyOptional({ example: "123456" })
  zipCode?: string;

  @ApiPropertyOptional({ example: "+2348182739942" })
  phone?: string;

  @ApiPropertyOptional({ example: true })
  isDefault?: boolean;
}
