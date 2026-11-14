import { ProductDiscountType } from "../enums/product-discount-type.enum";
import { ProductGender } from "../enums/product-gender.enum";

export interface IProductDiscount {
  amount: number;
  type: ProductDiscountType;
  finalPrice?: number;
}

export interface IProductVariation {
  _id?: string;
  name: string;
  attributes: Record<string, string>; // e.g. { color: "Red", size: "M", storage: "128GB" }
  price?: number;
  quantity: number;
}

/** Used when hasVariations is false; system uses this for cart/order processing. */
export type IDefaultVariation = Partial<IProductVariation> & {
  name: string;
  attributes: Record<string, string>;
  quantity: number;
};

export interface IProduct {
  _id: string;
  name: string;
  description?: string;
  amount: number;
  /** Optional product-wide discount (used when variation/default has no own discount). */
  discount?: IProductDiscount;
  categoryId: string;
  /** Present on API responses; null when unset or missing in DB (legacy products). */
  subcategoryId?: string | null;
  vendorId: string;
  images: string[];
  /** Resolved name from categoryId when the category exists. */
  category?: { id: string; name: string } | null;
  /** Resolved name from subcategoryId when set and the subcategory exists. */
  subcategory?: { id: string; name: string } | null;
  /** Null when not set; when set, must be a {@link ProductGender} value. */
  gender: ProductGender | null;
  variations: IProductVariation[];
  /** When hasVariations is false, used internally for cart and order processing. */
  defaultVariation?: IDefaultVariation;
  hasVariations: boolean;
  isFeatured: boolean;
  rating: number;
  totalRatings: number;
  status: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  vendor?: any;
  isFavourite?: boolean;
  /** Newest review on product detail; null when there are no reviews. */
  latestReview?: IProductLatestReview | null;
}

/** Matches {@link ProductReviewListItem} from the reviews API (embedded on product by id). */
export interface IProductLatestReview {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  markedHelpfulByMe: boolean;
  reviewer: {
    displayName: string;
    avatarUrl: string | null;
  };
}
