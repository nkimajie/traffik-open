import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema, Types } from "mongoose";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";

export type VendorLikeDocument = VendorLike & Document;

@Schema({ timestamps: true, collection: DBCollectionNames.VENDOR_LIKES })
export class VendorLike {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: DBCollectionNames.VENDORS,
    required: true,
    index: true,
  })
  vendorId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: DBCollectionNames.USERS,
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const VendorLikeSchema = SchemaFactory.createForClass(VendorLike);
VendorLikeSchema.index({ vendorId: 1, userId: 1 }, { unique: true });
