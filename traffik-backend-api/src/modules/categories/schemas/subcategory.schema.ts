import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";

export type SubcategoryDocument = Subcategory & Document;

@Schema({ timestamps: true })
export class Subcategory {
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  image?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Category",
    required: true,
  })
  categoryId: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: true })
  createdBy: string;

  createdAt: Date;
  updatedAt: Date;
}

export const SubcategorySchema = SchemaFactory.createForClass(Subcategory);

// Ensure name is unique within the same category
SubcategorySchema.index({ name: 1, categoryId: 1 }, { unique: true });
