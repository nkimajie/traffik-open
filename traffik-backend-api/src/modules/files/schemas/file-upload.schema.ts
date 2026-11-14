import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { IFileUpload } from "../interfaces/file-upload.interface";

export type FileUploadDocument = FileUpload & Document;

@Schema({ timestamps: true })
export class FileUpload implements IFileUpload {
  _id: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  publicId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ default: true })
  inUse: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const FileUploadSchema = SchemaFactory.createForClass(FileUpload);
