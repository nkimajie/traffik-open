import mongoose, { Document } from "mongoose";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { DBCollectionNames } from "../enums/db_collections_name.enum";

@Schema({ timestamps: true })
export class UsersFavouriteProduct {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: DBCollectionNames.USERS,
    required: true,
    index: true,
  })
  userId: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: DBCollectionNames.PRODUCTS,
    required: true,
    index: true,
  })
  productId: mongoose.Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;
}

export type UsersFavouriteProductDocument = UsersFavouriteProduct & Document;

export const UsersFavouriteProductSchema = SchemaFactory.createForClass(
  UsersFavouriteProduct,
);

UsersFavouriteProductSchema.index(
  { userId: 1, productId: 1 },
  { unique: true },
);
