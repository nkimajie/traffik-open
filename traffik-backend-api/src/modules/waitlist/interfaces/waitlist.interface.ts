export interface IWaitlist {
  _id: string;
  email: string;
  phone: IWaitlistPhone;
  isNotified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class IWaitlistPhone {
  countryCode: string;
  number: string;
}
