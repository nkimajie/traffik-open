import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { IAddress } from "../interfaces/address.interface";

export type AddressDocument = Document & Address;

@Schema({ timestamps: true })
export class Address implements IAddress {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  userId: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  streetAddress: string;

  @Prop()
  landmark?: string;

  @Prop({ required: true })
  zipCode: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ default: false })
  isDefault: boolean;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
