import { IProduct } from "./product.interface";

/** Store identity needed to head a group of saved products. */
export interface SavedProductsStore {
  _id: string;
  businessName?: string;
  storeLogo?: string | null;
  storeCoverPhoto?: string | null;
  isVerified?: boolean;
  /**
   * Opening times, so the client can show whether the store is open without a
   * second request. Absent for stores that never configured hours.
   */
  businessHours?: { day: string; open: string; close: string }[] | null;
}

export interface SavedProductsByStore {
  vendor: SavedProductsStore;
  productCount: number;
  products: IProduct[];
}
