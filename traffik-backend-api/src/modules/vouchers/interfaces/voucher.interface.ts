export interface IVoucher {
  _id: string;
  name: string;
  code: string;
  percentage: number;
  expiringDate: Date;
  isActive?: boolean;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
