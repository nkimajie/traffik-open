import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({
    description: "Category name",
    minLength: 2,
    maxLength: 50,
    example: "Electronics",
  })
  @IsNotEmpty({ message: "Category name is required" })
  @IsString({ message: "Category name must be a string" })
  @MinLength(2, { message: "Category name must be at least 2 characters long" })
  @MaxLength(50, { message: "Category name cannot exceed 50 characters" })
  name: string;

  @ApiProperty({
    description: "Category description",
    required: false,
    maxLength: 500,
    example: "Electronic devices and accessories",
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @MaxLength(500, { message: "Description cannot exceed 500 characters" })
  description?: string;
}
