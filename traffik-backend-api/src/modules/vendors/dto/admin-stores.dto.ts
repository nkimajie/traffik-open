import { ApiProperty } from "@nestjs/swagger";

export class AdminStoreItemDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  businessName: string;

  @ApiProperty({ required: false })
  firstName?: string;

  @ApiProperty({ required: false })
  lastName?: string;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty()
  storeLogo: string;

  @ApiProperty()
  storeCoverPhoto: string;

  @ApiProperty()
  businessCategory: string;

  @ApiProperty()
  totalItemsSold: number;

  @ApiProperty()
  totalOrders: number;

  @ApiProperty()
  isApproved: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class AdminStoresResponseDto {
  @ApiProperty({ type: [AdminStoreItemDto] })
  topStores: AdminStoreItemDto[];

  @ApiProperty({ type: [AdminStoreItemDto] })
  allStores: AdminStoreItemDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
