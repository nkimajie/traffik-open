/** Backend-aligned API types (mirrors traffik-backend-api interfaces) */

export type ProductDiscountType = "fixed" | "percentage";

export interface ProductDiscount {
  amount: number;
  type: ProductDiscountType;
  finalPrice?: number;
}

export interface ProductVariation {
  _id?: string;
  name: string;
  attributes: Record<string, string>;
  price?: number;
  quantity: number;
}

export interface ProductLatestReview {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  createdAt?: string;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  reviewer: {
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  amount: number;
  discount?: ProductDiscount;
  categoryId: string;
  subcategoryId?: string | null;
  vendorId: string;
  images: string[];
  category?: { id: string; name: string } | null;
  subcategory?: { id: string; name: string } | null;
  gender?: string | null;
  variations: ProductVariation[];
  defaultVariation?: {
    name: string;
    attributes: Record<string, string>;
    quantity: number;
    price?: number;
  };
  hasVariations: boolean;
  isFeatured: boolean;
  rating: number;
  totalRatings: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  vendor?: VendorSummary | null;
  isFavourite?: boolean;
  latestReview?: ProductLatestReview | null;
}

export type VendorCategoryRef = { _id: string; name: string };

export interface VendorSummary {
  _id: string;
  businessName?: string;
  storeLogo?: string;
  storeCoverPhoto?: string;
  description?: string;
  businessCategory?: string;
  businessCategories?: VendorCategoryRef[];
  totalLikes?: number;
  isLiked?: boolean;
  isApproved?: boolean;
}

export interface Vendor extends VendorSummary {
  firstName: string;
  lastName: string;
  email: string;
  phone?: { number: string | null; countryCode: string | null };
  isVerified: boolean;
  isActive: boolean;
  isSignupCompleted: boolean;
  isFeatured: boolean;
  isApproved: boolean;
  physicalStore?: boolean;
  physicalStoreAddress?: string;
  website?: string;
  businessHours?: { day: string; open: string; close: string }[];
  businessCategories?: VendorCategoryRef[];
  createdAt?: string;
  updatedAt?: string;
  productCategories?: { id: string; name: string }[];
  products?: PaginatedData<Product>;
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  image?: string;
  isActive?: boolean;
}

export interface Subcategory {
  _id: string;
  name: string;
  description?: string;
  categoryId: string;
  isActive?: boolean;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type DeliveryMethod = "PICKUP_STATION" | "DOOR_DELIVERY";

export interface OrderItem {
  productId: string;
  variationId?: string;
  name?: string;
  quantity: number;
  price: number;
  total: number;
  images?: string[];
  vendorId?: string;
  vendorName?: string;
  variation?: ProductVariation;
}

export type OrderRefundStatus = "REQUIRED" | "REFUNDED";

export type OrderRefundReason =
  | "ORDER_CANCELLED"
  | "ORDER_REJECTED"
  | "PAID_AFTER_CANCELLATION"
  | "DUPLICATE_PAYMENT";

export type OrderRefundPayoutMethod = "KASHIA" | "BANK_TRANSFER" | "OTHER";

export interface OrderRefundPayout {
  method: OrderRefundPayoutMethod;
  reference: string;
  /** Naira. */
  amount: number;
}

export type OrderRefundEventType =
  | "OPENED"
  | "COMPLETED"
  | "REOPENED"
  | "PROVIDER_REFUNDED";

/** One entry in a refund's append-only history. */
export interface OrderRefundEvent {
  _id: string;
  type: OrderRefundEventType;
  actor: "SYSTEM" | "KASHIA" | "ADMIN" | "SHOPPER";
  actorId?: string;
  at: string;
  reason?: string;
  payout?: OrderRefundPayout;
  /** Kashia refunded money an admin had already paid back another way. */
  possibleDoubleRefund?: boolean;
}

/** A refund owed to the shopper for one captured payment. */
export interface OrderRefund {
  _id: string;
  status: OrderRefundStatus;
  reason: OrderRefundReason;
  /** Naira. */
  amount: number;
  escrowId?: string;
  paymentReference?: string;
  requestedAt: string;
  refundedAt?: string;
  resolvedBy?: "KASHIA" | "ADMIN";
  /** Evidence for a refund completed by hand. */
  payout?: OrderRefundPayout;
  /** Kashia confirmed the money was returned. */
  providerConfirmedAt?: string;
  /** Shown to the shopper, e.g. where the money was sent. */
  note?: string;
  history?: OrderRefundEvent[];
}

export type OrderPaymentAlertType =
  | "ESCROW_DISPUTED"
  | "ESCROW_REVERSED_AFTER_SHIPPING"
  | "ESCROW_CANCELLED_AFTER_PAYMENT"
  | "ESCROW_RELEASED_FOR_CANCELLED_ORDER"
  | "ESCROW_RELEASED_BEFORE_SHIPPING"
  | "OTHER_ESCROW_RELEASED";

/** Where an order and its money disagree; kept until an admin resolves it. */
export interface OrderPaymentAlert {
  _id: string;
  type: OrderPaymentAlertType;
  escrowId?: string;
  orderStatus: OrderStatus;
  message: string;
  raisedAt: string;
  resolvedAt?: string;
  resolvedByAdminId?: string;
  resolutionNote?: string;
}

export interface Order {
  _id: string;
  userId: string;
  vendorId?: string;
  orderRef?: string;
  items: OrderItem[];
  shippingAddress: Address;
  deliveryMethod: DeliveryMethod;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  status: OrderStatus;
  paymentReference?: string;
  paymentUrl?: string;
  escrowId?: string;
  escrowStatus?: string;
  paymentStatus?: "confirmed" | "already_confirmed" | "pending" | "failed";
  kashiaPaymentLinkStatus?: string;
  timeline?: { status: OrderStatus; description: string; date: string }[];
  refunds?: OrderRefund[];
  paymentAlerts?: OrderPaymentAlert[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentReturnSummary {
  orderId: string;
  orderRef?: string;
  paymentStatus: "confirmed" | "already_confirmed" | "pending" | "failed";
  kashiaPaymentLinkStatus?: string;
}

export interface Address {
  _id: string;
  userId?: string;
  fullName: string;
  state: string;
  city: string;
  streetAddress: string;
  landmark?: string;
  zipCode: string;
  phone: string;
  isDefault?: boolean;
}

export interface CartItem {
  productId: string;
  variationId?: string;
  quantity: number;
  listUnitPrice: number;
  price: number;
  total: number;
  vendorId?: string;
  product?: Product;
}

export interface CartVendorSummary {
  _id: string;
  businessName?: string;
  storeLogo?: string | null;
  storeCoverPhoto?: string | null;
  isVerified?: boolean;
}

export interface Cart {
  _id?: string;
  userId?: string;
  items: CartItem[];
  subtotal: number;
  hasVoucher?: boolean;
  vendorId?: string | null;
  vendor?: CartVendorSummary | null;
}

export interface SavedProductsStore {
  _id: string;
  businessName?: string;
  storeLogo?: string | null;
  storeCoverPhoto?: string | null;
  isVerified?: boolean;
  businessHours?: { day: string; open: string; close: string }[] | null;
}

export interface SavedProductsByStore {
  vendor: SavedProductsStore;
  productCount: number;
  products: Product[];
}

export interface NotificationChannelSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
}

export interface NotificationSettings {
  general: boolean;
  updates: NotificationChannelSettings;
  promotions: NotificationChannelSettings;
}

export interface ShopperProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: { number: string | null; countryCode: string | null };
  role: string;
  isVerified: boolean;
  profilePicture?: { pictureID: string; url: string } | null;
  notificationSettings?: NotificationSettings;
}

export interface ProductReview {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  createdAt?: string;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  markedHelpfulByMe?: boolean;
  reviewer: {
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface VendorDashboardData {
  summary: {
    availableBalance: { value: number };
    revenue: { value: number; percentageChange: number; isIncrease: boolean };
    profits: { value: number; percentageChange: number; isIncrease: boolean };
  };
  engagement?: {
    monthlyStoreBookmarks: number;
    itemFavourites: number;
  };
  recentCustomers?: PaginatedData<{
    userId: string;
    name: string;
    amount: number;
    lastTransaction: string;
  }>;
  topPerformers?: Array<{
    productId: string;
    name: string;
    soldCount: number;
    image?: string;
    category?: string;
    subcategory?: string;
    likeCount?: number;
  }>;
}

export interface SearchResults {
  products?: PaginatedData<Product>;
  vendors?: PaginatedData<Vendor>;
}
