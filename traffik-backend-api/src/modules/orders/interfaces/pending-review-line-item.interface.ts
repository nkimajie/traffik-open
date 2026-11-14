/**
 * One purchasable line on the "pending reviews" screen: delivered (or filtered)
 * order row with no review yet for this user + product.
 */
export interface IPendingReviewLineItem {
  orderId: string;
  /** Human-friendly label for UI, e.g. "Order № 01947034" */
  orderNumber: string;
  orderStatus: string;
  productId: string;
  productName: string;
  productImage: string | null;
  quantity: number;
  /** Best-effort delivery time from timeline, else order updatedAt */
  date: string;
  /**
   * No review document exists yet for this user + product (that is why the row appears).
   * Submit with POST /products/{productId}/reviews and optional body.orderId when eligible.
   */
  review: null;
}
