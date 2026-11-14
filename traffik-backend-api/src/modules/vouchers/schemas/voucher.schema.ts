import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { IVoucher } from "../interfaces/voucher.interface";

export type VoucherDocument = Voucher & Document;

@Schema({ timestamps: true })
export class Voucher implements IVoucher {
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, uppercase: true })
  code: string;

  @Prop({ required: true, min: 0, max: 100 })
  percentage: number;

  @Prop({ required: true })
  expiringDate: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: true })
  createdBy: string;

  createdAt: Date;
  updatedAt: Date;
}

export const VoucherSchema = SchemaFactory.createForClass(Voucher);
