export const QueryKeys = {
  // Auth
  LOGIN: "/auth/login",
  REGISTER: "/auth/signup",

  // Catalog (public)
  PRODUCTS: "/products",
  PRODUCT: "/products",
  PRODUCTS_FEATURED: "/products/featured",
  PRODUCTS_DEALS: "/products/deals",
  CATEGORIES: "/categories",
  VENDORS_PUBLIC: "/vendors/public",
  VENDORS_PUBLIC_TRENDING: "/vendors/public/trending",
  VENDOR_PUBLIC: "/vendors/public",
  SEARCH: "/search",

  // Shopper
  CART: "/carts",
  ORDERS: "/orders",
  ADDRESSES: "/addresses",
  PROFILE: "/users/profile",
  SAVED_PRODUCTS: "/products/user/saved-products",
  SAVED_PRODUCTS_GROUPED: "/products/user/saved-products/grouped",
  SAVED_STORES: "/vendors/saved-stores",

  // Vendor
  VENDOR_DASHBOARD: "/vendors/dashboard",
  VENDOR_PRODUCTS: "/products/vendor/me",
  VENDOR_ORDERS: "/vendors/orders",
  VENDOR_CUSTOMERS: "/vendors/my-customers",
  VENDOR_TRANSACTIONS: "/vendors/transactions",
  VENDOR_PROFILE: "/vendors/me",

  // Admin
  ADMIN_STORES: "/vendors/admin/all-stores",
  ADMIN_KYC: "/vendors/kyc/admin",
  ADMIN_ORDERS: "/orders/admin",
  ADMIN_EMAIL_TEMPLATES: "/admin/email/templates",
  ADMIN_EMAIL_CONFIG: "/admin/email/config",
  ADMIN_PLATFORM_SETTINGS: "/admin/settings",
  VOUCHERS: "/vouchers",
} as const;

export type QueryKey = (typeof QueryKeys)[keyof typeof QueryKeys];
