export interface IAddress {
  userId: string;
  fullName: string;
  state: string;
  city: string;
  streetAddress: string;
  landmark?: string;
  zipCode: string;
  phone: string;
  isDefault: boolean;
}
