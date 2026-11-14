import { ApiProperty } from "@nestjs/swagger";
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateSubcategoryDto {
  @ApiProperty({
    description: "Subcategory name",
    minLength: 2,
    maxLength: 50,
    example: "Shoes",
  })
  @IsNotEmpty({ message: "Subcategory name is required" })
  @IsString({ message: "Subcategory name must be a string" })
  @MinLength(2, { message: "Subcategory name must be at least 2 characters long" })
  @MaxLength(50, { message: "Subcategory name cannot exceed 50 characters" })
  name: string;

  @ApiProperty({
    description: "Parent Category ID",
    example: "507f1f77bcf86cd799439011",
  })
  @IsNotEmpty({ message: "Category ID is required" })
  @IsMongoId({ message: "Invalid category ID" })
  categoryId: string;

  @ApiProperty({
    description: "Subcategory description",
    required: false,
    maxLength: 500,
    example: "Running and casual shoes",
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @MaxLength(500, { message: "Description cannot exceed 500 characters" })
  description?: string;
}
