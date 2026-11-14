import mongoose, { Document } from "mongoose";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { DBCollectionNames } from "../enums/db_collections_name.enum";

@Schema({ timestamps: true })
export class UsersFavouriteStore {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: DBCollectionNames.USERS,
    required: true,
    index: true,
  })
  userId: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: DBCollectionNames.VENDORS,
    required: true,
    index: true,
  })
  vendorId: mongoose.Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export type UsersFavouriteStoreDocument = UsersFavouriteStore & Document;

export const UsersFavouriteStoreSchema =
  SchemaFactory.createForClass(UsersFavouriteStore);

UsersFavouriteStoreSchema.index({ userId: 1, vendorId: 1 }, { unique: true });
