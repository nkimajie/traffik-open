import { UserRole } from "../../users/enums/user-role.enum";
import { UserLoginType } from "../../users/enums/users.enum";
import { IUserPhone } from "../../users/interfaces/users.interface";
import { PrivateVendorField } from "../constants/vendor-private-fields.constant";

export interface IVendor {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone: IUserPhone;
  countryISOCode: string;
  isVerified: boolean;
  role: UserRole;
  businessName: string;
  storeLogo: string;
  storeCoverPhoto: string;
  businessEmail?: string;
  businessPhone?: string;
  physicalStore?: boolean;
  physicalStoreAddress?: string;
  website?: string;
  description?: string;
  businessHours?: {
    day: string;
    open: string;
    close: string;
  }[];
  /** Store-set delivery fee. Store revenue, not a platform charge. */
  deliveryFee?: number;
  pickupAvailable?: boolean;
  /** Order value below which the store will not accept an order. 0 disables. */
  minimumOrderValue?: number;
  businessCategory?: string;
  businessCategories?: string[] | { _id: string; name: string }[];
  profilePicture?: string;
  loginType: UserLoginType;
  googleId?: string;
  appleId?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  isSignupCompleted: boolean;
  isFeatured: boolean;
  isApproved: boolean;
  /** Kashia Vault customer UUID for marketplace payouts. */
  kashiaCustomerId?: string;
  totalLikes: number;
  /** When the viewer is a buyer (USER) and authenticated; omitted or false otherwise. */
  isLiked?: boolean;
  categories?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A store as shown to shoppers and the public: {@link IVendor} without the
 * owner's private account fields.
 */
export type IPublicVendor = Omit<IVendor, "isLiked" | PrivateVendorField>;
