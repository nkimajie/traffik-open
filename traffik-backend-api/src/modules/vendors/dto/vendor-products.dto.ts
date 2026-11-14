import { ApiProperty } from "@nestjs/swagger";
import { TopPerformerDto } from "./vendor-dashboard.dto";

export enum ProductSortOption {
  MOST_SOLD = "most-sold",
  MOST_LIKED = "most-liked",
  NEWEST = "newest",
  PRICE_HIGH_TO_LOW = "price-high-to-low",
  PRICE_LOW_TO_HIGH = "price-low-to-high",
}

export enum ProductStatusFilter {
  ALL = "all",
  SOLD_OUT = "sold-out",
  ACTIVE = "active",
}

export class VendorProductItemDto extends TopPerformerDto {
  @ApiProperty()
  price: number;

  @ApiProperty()
  isSoldOut: boolean;

  @ApiProperty()
  totalStock: number;
}

export class VendorProductsResponseDto {
  @ApiProperty({ type: [VendorProductItemDto] })
  topPerformers: VendorProductItemDto[];

  @ApiProperty({ type: [VendorProductItemDto] })
  allItems: VendorProductItemDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
