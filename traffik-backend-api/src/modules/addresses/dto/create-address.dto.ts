import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateAddressDto {
  @ApiProperty({ example: "John Doe" })
  fullName: string;

  @ApiProperty({ example: "Lagos" })
  state: string;

  @ApiProperty({ example: "Ikeja" })
  city: string;

  @ApiProperty({ example: "1234 All balogun off gbagada road" })
  streetAddress: string;

  @ApiPropertyOptional({ example: "Near the big tree" })
  landmark?: string;

  @ApiProperty({ example: "123456" })
  zipCode: string;

  @ApiProperty({ example: "+2348182739942" })
  phone: string;

  @ApiPropertyOptional({ example: false, default: false })
  isDefault?: boolean;
}
