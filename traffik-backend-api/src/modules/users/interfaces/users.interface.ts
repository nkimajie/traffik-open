import { UserRole } from "../enums/user-role.enum";
import { UserLoginType } from "../enums/users.enum";
import { UserInterest } from "../constants/interests.constant";

export interface IUserPhone {
  number: string;
  countryCode: string;
}

export interface INotificationChannels {
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface INotificationSettings {
  general: boolean;
  updates: INotificationChannels;
  promotions: INotificationChannels;
}

export interface IUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: IUserPhone;
  countryISOCode?: string;
  role: UserRole;
  interests: UserInterest[];
  isInterestSet: boolean;
  profilePicture?: {
    pictureID: string;
    url: string;
  };
  loginType: UserLoginType;
  googleId?: string;
  appleId?: string;
  isVerified: boolean;
  notificationSettings?: INotificationSettings;
  tokenVersion?: number;
  /** Kashia Vault customer UUID for escrow payments. */
  kashiaCustomerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
