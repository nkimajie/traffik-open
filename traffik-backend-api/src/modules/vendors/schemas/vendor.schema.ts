import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { UserRole } from "../../users/enums/user-role.enum";
import { IVendor } from "../interfaces/vendors.interface";
import { UserLoginType } from "../../users/enums/users.enum";

export type VendorDocument = Document & Vendor;

@Schema({ timestamps: true })
export class Vendor implements IVendor {
  _id: string;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 0 })
  totalLikes: number;

  createdAt: Date;
  updatedAt: Date;

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
  })
  phone: {
    number: string;
    countryCode: string;
  };

  @Prop({ default: null })
  countryISOCode: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.VENDOR })
  role: UserRole;

  @Prop({ default: null })
  businessName: string;

  @Prop({ default: null })
  storeLogo: string;

  @Prop({ default: null })
  storeCoverPhoto: string;

  @Prop({ default: null })
  businessEmail: string;

  @Prop({ default: null })
  businessPhone: string;

  @Prop({ default: null })
  physicalStore: boolean;

  @Prop({ default: null })
  physicalStoreAddress?: string;

  @Prop({ default: null })
  website?: string;

  @Prop({ default: null })
  description?: string;

  @Prop({
    type: [{ day: String, open: String, close: String }],
    default: null,
  })
  businessHours?: {
    day: string;
    open: string;
    close: string;
  }[];

  /**
   * Delivery is priced and fulfilled by the store, so the fee is the store's own
   * revenue and travels inside the escrow amount rather than being a platform charge.
   */
  @Prop({ default: 0, min: 0 })
  deliveryFee: number;

  /** Whether shoppers may collect in person instead of paying for delivery. */
  @Prop({ default: true })
  pickupAvailable: boolean;

  /** Order value below which the store will not accept an order. 0 disables the check. */
  @Prop({ default: 0, min: 0 })
  minimumOrderValue: number;

  @Prop({ default: null })
  businessCategory?: string;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: "Category" }],
    default: [],
  })
  businessCategories?: string[];

  @Prop({ default: null })
  profilePicture: string;

  @Prop({ type: String, enum: UserLoginType, default: UserLoginType.EMAIL })
  loginType: UserLoginType;

  @Prop({ default: null })
  googleId: string;

  @Prop({ default: null })
  appleId: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: null })
  lastLoginAt: Date;

  @Prop({ default: false })
  isSignupCompleted: boolean;

  @Prop({ default: false })
  isApproved: boolean;

  /** Kashia Vault customer UUID — created at store approval or first order. */
  @Prop({ default: null, index: true, sparse: true })
  kashiaCustomerId?: string;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
