import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { KycStatus } from "../enums/vendor-kyc.enum";

export type VendorKycDocument = Document & VendorKyc;

@Schema({ timestamps: true })
export class VendorKyc {
  _id: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Vendor", required: true })
  vendor: string;

  @Prop({ required: true })
  bankName: string;

  @Prop({ required: true })
  accountNumber: string;

  @Prop({ required: true })
  dob: string;

  @Prop({ required: true })
  bvn: string;

  @Prop({ type: String, enum: KycStatus, default: KycStatus.PENDING })
  status: KycStatus;

  @Prop({ default: null })
  notes: string;

  createdAt: Date;
  updatedAt: Date;
}

export const VendorKycSchema = SchemaFactory.createForClass(VendorKyc);
