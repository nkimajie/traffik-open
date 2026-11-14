import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { DBCollectionNames } from "../../shared/enums/db_collections_name.enum";

export type PlatformSettingsDocument = Document & PlatformSettings;

/** Singleton platform configuration editable from the admin console. */
@Schema({ timestamps: true, collection: DBCollectionNames.PLATFORM_SETTINGS })
export class PlatformSettings {
  @Prop({ required: true, unique: true, default: "default" })
  key: string;

  /**
   * Traffik marketplace commission charged to the buyer via Kashia
   * `merchant_fee_percentage`. Range 0–20; 0 disables the platform cut.
   */
  @Prop({ default: 0, min: 0, max: 20 })
  commissionPercentage: number;

  updatedAt?: Date;
  createdAt?: Date;
}

export const PlatformSettingsSchema =
  SchemaFactory.createForClass(PlatformSettings);
