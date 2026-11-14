import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

export enum SearchType {
  VENDORS = "vendors",
  PRODUCTS = "products",
}

export class SearchDto {
  @ApiProperty({
    description: "Search query string",
    example: "coffee shop",
    required: true,
  })
  @IsString()
  q: string;

  @ApiProperty({
    description: "Type of search (vendors or products)",
    enum: SearchType,
    example: SearchType.VENDORS,
    required: true,
  })
  @IsEnum(SearchType)
  type: SearchType;

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
