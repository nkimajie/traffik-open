export interface IFileUpload {
  _id: string;
  url: string;
  publicId: string;
  userId: string;
  inUse: boolean;
  createdAt: Date;
  updatedAt: Date;
}
