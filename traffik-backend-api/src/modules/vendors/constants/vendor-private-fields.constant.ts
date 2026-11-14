/**
 * Owner/account fields that must not leave the API on shopper-facing or public
 * store responses. Business contact details (businessEmail, businessPhone) stay
 * public; the owner's personal login email and phone do not.
 */
export const PRIVATE_VENDOR_FIELDS = [
  "email",
  "phone",
  "countryISOCode",
  "googleId",
  "appleId",
  "loginType",
  "lastLoginAt",
  "kashiaCustomerId",
] as const;

export type PrivateVendorField = (typeof PRIVATE_VENDOR_FIELDS)[number];
