import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { UserRole } from "../enums/user-role.enum";
import { IUser } from "../interfaces/users.interface";
import { UserLoginType } from "../enums/users.enum";
import {
  AVAILABLE_INTERESTS,
  UserInterest,
} from "../constants/interests.constant";
import {
  NotificationSettings,
  NotificationSettingsSchema,
} from "./notification-settings.schema";

export type UserDocument = Document & User;

@Schema({ timestamps: true })
export class User implements IUser {
  _id: string;
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({
    type: { number: String, countryCode: String },
    _id: false,
    default: null,
  })
  phone?: {
    number: string;
    countryCode: string;
  };

  @Prop({ default: null })
  countryISOCode: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Prop({ type: [String], enum: AVAILABLE_INTERESTS, default: [] })
  interests: UserInterest[];

  @Prop({ default: false })
  isInterestSet: boolean;

  @Prop({
    type: { pictureID: String, url: String },
    default: null,
    _id: false,
  })
  profilePicture: {
    pictureID: string;
    url: string;
  };

  @Prop({ type: String, enum: UserLoginType, default: UserLoginType.EMAIL })
  loginType: UserLoginType;

  @Prop({ default: null })
  googleId: string;

  @Prop({ default: null })
  appleId: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ type: NotificationSettingsSchema, default: () => ({}) })
  notificationSettings: NotificationSettings;

  @Prop({ default: 0 })
  tokenVersion: number;

  /** Kashia Vault customer UUID — created lazily at first checkout. */
  @Prop({ default: null, index: true, sparse: true })
  kashiaCustomerId?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
