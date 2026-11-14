import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class BrandSearchDto {
  @ApiProperty({
    description: "Search query for brands",
    example: "nike",
    required: false,
  })
  @IsString()
  @IsOptional()
  q?: string;
}

export class PriceRangeDto {
  @ApiProperty({
    description: "Minimum price",
    example: 10,
    required: true,
  })
  @IsNumber()
  @Min(0)
  minPrice: number;

  @ApiProperty({
    description: "Maximum price",
    example: 1000,
    required: true,
  })
  @IsNumber()
  @Min(0)
  maxPrice: number;
}

export class ProductFiltersDto {
  @ApiProperty({
    description: "Array of brand IDs to filter by",
    type: [String],
    example: ["507f1f77bcf86cd799439011"],
    required: false,
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  brands?: string[];

  @ApiProperty({
    description: "Array of category IDs to filter by",
    type: [String],
    example: ["507f1f77bcf86cd799439011"],
    required: false,
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  categories?: string[];

  @ApiProperty({
    description: "Price range filter",
    type: PriceRangeDto,
    required: false,
  })
  @ValidateNested()
  @Type(() => PriceRangeDto)
  @IsOptional()
  priceRange?: PriceRangeDto;

  @ApiProperty({
    description: "Page number (starts from 1)",
    example: 1,
    required: false,
    default: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: "Number of items per page",
    example: 10,
    required: false,
    default: 10,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
