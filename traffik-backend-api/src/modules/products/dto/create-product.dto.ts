import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ProductDiscountDto } from "./product-discount.dto";
import { ProductGender } from "../enums/product-gender.enum";
import { IsEnum } from "class-validator";

class ProductVariationDto {
  @ApiProperty({
    description: "Variation name",
    example: "128GB - Black",
    maxLength: 100,
  })
  @IsString({ message: "Name must be a string" })
  @MinLength(2, { message: "Name must be at least 2 characters long" })
  @MaxLength(100, { message: "Name cannot exceed 100 characters" })
  name: string;

  @ApiProperty({
    description: "Attributes as key-value pairs (e.g. color, size, storage)",
    example: { color: "Black", size: "128GB" },
  })
  @IsObject({ message: "Attributes must be an object" })
  attributes: Record<string, string>;

  @ApiProperty({
    description: "Variation price (if different from main price)",
    required: false,
    minimum: 0,
    example: 29.99,
  })
  @IsOptional()
  @IsNumber({}, { message: "Price must be a number" })
  @Min(0, { message: "Price cannot be negative" })
  @Max(1000000, { message: "Price cannot exceed 1,000,000" })
  price?: number;

  @ApiProperty({
    description: "Available quantity",
    minimum: 0,
    example: 100,
  })
  @IsNumber({}, { message: "Quantity must be a number" })
  @Min(0, { message: "Quantity cannot be negative" })
  @Max(1000000, { message: "Quantity cannot exceed 1,000,000" })
  quantity: number;
}

export class CreateProductDto {
  @ApiProperty({
    description: "Product name",
    minLength: 3,
    maxLength: 100,
    example: "iPhone 13 Pro",
  })
  @IsString({ message: "Product name must be a string" })
  @MinLength(3, { message: "Product name must be at least 3 characters long" })
  @MaxLength(100, { message: "Product name cannot exceed 100 characters" })
  name: string;

  @ApiProperty({
    description: "Product description",
    required: false,
    maxLength: 2000,
    example: "Latest iPhone model with advanced camera system",
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @MaxLength(2000, { message: "Description cannot exceed 2000 characters" })
  description?: string;

  @ApiProperty({
    description: "Product base price",
    minimum: 0,
    example: 999.99,
  })
  @IsNumber({}, { message: "Amount must be a number" })
  @Min(0, { message: "Amount cannot be negative" })
  @Max(1000000, { message: "Amount cannot exceed 1,000,000" })
  amount: number;

  @ApiProperty({
    description:
      "Product-wide discount when variations have no own discount (or for default variation). Omit for no discount.",
    required: false,
    type: ProductDiscountDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDiscountDto)
  discount?: ProductDiscountDto;

  @ApiProperty({
    description: "Category ID",
    example: "507f1f77bcf86cd799439011",
  })
  @IsMongoId({ message: "Invalid category ID" })
  categoryId: string;

  @ApiProperty({
    description: "subcategoryId (optional)",
    required: false,
    example: "507f1f77bcf86cd799439011",
  })
  @IsOptional()
  @IsMongoId({ message: "Invalid subcategory ID" })
  subcategoryId?: string;

  @ApiProperty({
    description: "Product images URLs",
    type: [String],
    example: ["https://example.com/image1.jpg"],
  })
  @IsArray({ message: "Images must be an array" })
  @IsUrl({}, { each: true, message: "Each image must be a valid URL" })
  @MaxLength(1000, {
    each: true,
    message: "Image URL cannot exceed 1000 characters",
  })
  images: string[];

  @ApiProperty({
    description:
      "Optional: MEN, WOMEN, UNISEX, or KIDS. Omit or null when the product is not gender-specific.",
    enum: ProductGender,
    required: false,
    nullable: true,
    example: null,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsEnum(ProductGender, { message: "Invalid gender value" })
  gender?: ProductGender | null;

  @ApiProperty({
    description:
      "Initial quantity when no variations are provided (used for the default variation). Ignored when variations are provided.",
    required: false,
    minimum: 0,
    default: 0,
    example: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: "Quantity must be a number" })
  @Min(0, { message: "Quantity cannot be negative" })
  @Max(1000000, { message: "Quantity cannot exceed 1,000,000" })
  quantity?: number;

  @ApiProperty({
    description:
      "Product variations. If omitted or empty, a default variation is created from product name and amount.",
    required: false,
    type: [ProductVariationDto],
  })
  @IsOptional()
  @IsArray({ message: "Variations must be an array" })
  @ValidateNested({ each: true, message: "Each variation must be valid" })
  @Type(() => ProductVariationDto)
  variations?: ProductVariationDto[];

  @ApiProperty({
    description:
      "Attribute map when the product has no variations; stored on defaultVariation.attributes (same idea as each variation's attributes). Do not send when variations is non-empty.",
    required: false,
    example: {
      color: "Navy",
      colorCode: "#001F3F",
      material: "Cotton",
    },
  })
  @IsOptional()
  @IsObject({ message: "Attributes must be an object" })
  attributes?: Record<string, string>;
}
