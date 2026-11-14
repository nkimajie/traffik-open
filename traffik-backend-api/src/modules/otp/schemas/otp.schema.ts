import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type OtpDocument = Otp & Document;

@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  secret: string;

  @Prop({ default: false })
  isUsed: boolean;

  /** Verification attempts made against this code; capped to stop guessing. */
  @Prop({ default: 0 })
  attempts: number;

  @Prop()
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);
