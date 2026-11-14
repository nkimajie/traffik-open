import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { IWaitlist, IWaitlistPhone } from "../interfaces/waitlist.interface";

export type WaitlistDocument = Waitlist & Document;

@Schema({ timestamps: true })
export class Waitlist implements IWaitlist {
  _id: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({
    type: IWaitlistPhone,
    required: true,
  })
  phone: IWaitlistPhone;

  @Prop({ default: false })
  isNotified: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const WaitlistSchema = SchemaFactory.createForClass(Waitlist);
