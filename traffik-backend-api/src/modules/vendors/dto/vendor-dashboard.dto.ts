import { ApiProperty } from "@nestjs/swagger";

export enum DashboardDuration {
  TODAY = "today",
  YESTERDAY = "yesterday",
  LAST_7_DAYS = "7days",
  LAST_30_DAYS = "30days",
  THIS_MONTH = "thisMonth",
  ALL_TIME = "allTime",
}

export class DashboardStatsDto {
  @ApiProperty()
  value: number;

  @ApiProperty({ required: false })
  percentageChange?: number;

  @ApiProperty({ required: false })
  isIncrease?: boolean;
}

export class RecentCustomerDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  lastTransaction: Date;
}

export class TopPerformerDto {
  @ApiProperty()
  productId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  image: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  subcategory: string;

  @ApiProperty()
  soldCount: number;

  @ApiProperty()
  likeCount: number;
}

export class VendorDashboardResponseDto {
  @ApiProperty()
  summary: {
    availableBalance: DashboardStatsDto;
    revenue: DashboardStatsDto;
    profits: DashboardStatsDto;
  };

  @ApiProperty()
  engagement: {
    monthlyStoreBookmarks: number;
    itemFavourites: number;
  };

  @ApiProperty({ type: [RecentCustomerDto] })
  recentCustomers: RecentCustomerDto[];

  @ApiProperty({ type: [TopPerformerDto] })
  topPerformers: TopPerformerDto[];
}
