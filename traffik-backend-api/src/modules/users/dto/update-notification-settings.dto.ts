import { IsBoolean, IsOptional, ValidateNested } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class UpdateNotificationChannelsDto {
  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  email?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  push?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  sms?: boolean;
}

export class UpdateNotificationSettingsDto {
  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  general?: boolean;

  @ApiProperty({ type: UpdateNotificationChannelsDto, required: false })
  @ValidateNested()
  @Type(() => UpdateNotificationChannelsDto)
  @IsOptional()
  updates?: UpdateNotificationChannelsDto;

  @ApiProperty({ type: UpdateNotificationChannelsDto, required: false })
  @ValidateNested()
  @Type(() => UpdateNotificationChannelsDto)
  @IsOptional()
  promotions?: UpdateNotificationChannelsDto;
}
