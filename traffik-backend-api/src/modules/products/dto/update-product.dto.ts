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
    description:
      "Id of an existing option, to change it. Omit for a new option. Existing options left out of the list are removed. Keep ids stable: carts and orders point at them.",
    required: false,
    example: "665f1f77bcf86cd799439011",
  })
  @IsOptional()
  @IsMongoId({ message: "Invalid option id" })
  _id?: string;

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

  @ApiProperty({
    description:
      "For an existing option: the stock shown when the form was opened. Stock changes as orders come in, so `quantity` is only written when it differs from this, and is refused (409 STOCK_CHANGED) if the stock has moved since. Required to change an existing option's stock.",
    required: false,
    minimum: 0,
    example: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: "Expected quantity must be a number" })
  @Min(0, { message: "Expected quantity cannot be negative" })
  expectedQuantity?: number;

  @ApiProperty({
    description: "Optional variation-level discount (overrides product discount).",
    required: false,
    type: ProductDiscountDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDiscountDto)
  discount?: ProductDiscountDto;
}

export class UpdateProductDto {
  @ApiProperty({
    description: "Product name",
    minLength: 3,
    maxLength: 100,
    example: "iPhone 13 Pro",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Product name must be a string" })
  @MinLength(3, { message: "Product name must be at least 3 characters long" })
  @MaxLength(100, { message: "Product name cannot exceed 100 characters" })
  name?: string;

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
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: "Amount must be a number" })
  @Min(0, { message: "Amount cannot be negative" })
  @Max(1000000, { message: "Amount cannot exceed 1,000,000" })
  amount?: number;

  @ApiProperty({
    description: "Product-wide discount. Omit to leave unchanged; send null via PATCH body only if your client supports clearing nested objects.",
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
    required: false,
  })
  @IsOptional()
  @IsMongoId({ message: "Invalid category ID" })
  categoryId?: string;

  @ApiProperty({
    description:
      "subcategoryId (optional)",
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
    required: false,
  })
  @IsOptional()
  @IsArray({ message: "Images must be an array" })
  @IsUrl({}, { each: true, message: "Each image must be a valid URL" })
  @MaxLength(1000, {
    each: true,
    message: "Image URL cannot exceed 1000 characters",
  })
  images?: string[];

  @ApiProperty({
    description:
      "Optional: MEN, WOMEN, UNISEX, or KIDS. Send null to clear. Omit to leave unchanged.",
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
      "Stock for products with no variations; updates defaultVariation.quantity (send expectedQuantity with it). Ignored when the product uses variations.",
    required: false,
    minimum: 0,
    example: 25,
  })
  @IsOptional()
  @IsNumber({}, { message: "Quantity must be a number" })
  @Min(0, { message: "Quantity cannot be negative" })
  @Max(1000000, { message: "Quantity cannot exceed 1,000,000" })
  quantity?: number;

  @ApiProperty({
    description:
      "The stock shown when the form was opened. Stock changes as orders come in, so `quantity` is only written when it differs from this, and is refused (409 STOCK_CHANGED, with the current figure) if the stock has moved since. Required to change stock; `quantity` equal to the current stock is accepted without it.",
    required: false,
    minimum: 0,
    example: 25,
  })
  @IsOptional()
  @IsNumber({}, { message: "Expected quantity must be a number" })
  @Min(0, { message: "Expected quantity cannot be negative" })
  expectedQuantity?: number;

  @ApiProperty({
    description: "Product variations",
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
      "When the product has no variations, updates defaultVariation.attributes. Omit when using variations.",
    required: false,
    example: { color: "Navy", size: "L" },
  })
  @IsOptional()
  @IsObject({ message: "Attributes must be an object" })
  attributes?: Record<string, string>;
}
