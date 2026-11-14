import axiosInstance from "../../config/axios-instance";
import { unwrapAxios } from "../../config/unwrap-response";
import { QueryKeys } from "../../config/query-keys";
import {
  CartVendorConflictError,
  type CartVendorConflict,
} from "@/lib/types/cart-conflict";
import type {
  Address,
  Cart,
  NotificationSettings,
  Order,
  OrderStatus,
  PaginatedData,
  PaymentReturnSummary,
  Product,
  SavedProductsByStore,
  ShopperProfile,
  Vendor,
  VendorDashboardData,
} from "@/lib/types/api";
import { isAxiosError } from "axios";

// --- Cart ---
export async function fetchCart(): Promise<Cart> {
  const res = await axiosInstance.get(QueryKeys.CART);
  return unwrapAxios<Cart>(res);
}

export async function addCartItem(payload: {
  productId: string;
  quantity: number;
  variationId?: string;
}): Promise<Cart> {
  try {
    const res = await axiosInstance.post(`${QueryKeys.CART}/items`, payload);
    return unwrapAxios<Cart>(res);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 409) {
      const body = error.response.data as { data?: CartVendorConflict; message?: string };
      if (body?.data?.code === "CART_VENDOR_CONFLICT") {
        throw new CartVendorConflictError(
          body.data,
          body.message ?? "Cart belongs to a different store",
        );
      }
    }
    throw error;
  }
}

export async function saveCartItemForLater(productId: string): Promise<{
  cart: Cart;
  savedCount: number;
}> {
  const res = await axiosInstance.post(`${QueryKeys.CART}/items/save-for-later`, {
    productId,
  });
  return unwrapAxios(res);
}

export async function replaceCart(payload: {
  productId: string;
  quantity: number;
  variationId?: string;
}): Promise<{ cart: Cart; savedCount: number }> {
  const res = await axiosInstance.post(`${QueryKeys.CART}/replace`, payload);
  return unwrapAxios(res);
}

export async function updateCartItem(
  productId: string,
  quantity: number,
): Promise<Cart> {
  const res = await axiosInstance.patch(
    `${QueryKeys.CART}/items/${productId}`,
    { quantity },
  );
  return unwrapAxios<Cart>(res);
}

export async function removeCartItem(productId: string): Promise<Cart> {
  const res = await axiosInstance.delete(
    `${QueryKeys.CART}/items/${productId}`,
  );
  return unwrapAxios<Cart>(res);
}

export async function clearCart(): Promise<void> {
  await axiosInstance.delete(`${QueryKeys.CART}/clear`);
}

// --- Orders ---
export async function fetchOrders(params?: {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}): Promise<PaginatedData<Order>> {
  const res = await axiosInstance.get(QueryKeys.ORDERS, { params });
  return unwrapAxios<PaginatedData<Order>>(res);
}

export async function fetchOrderById(id: string): Promise<Order> {
  const res = await axiosInstance.get(`${QueryKeys.ORDERS}/${id}`);
  return unwrapAxios<Order>(res);
}

export async function previewOrder(payload: {
  addressId: string;
  deliveryMethod: string;
}): Promise<unknown> {
  const res = await axiosInstance.post(`${QueryKeys.ORDERS}/preview`, payload);
  return unwrapAxios(res);
}

export async function createOrder(payload: {
  addressId: string;
  deliveryMethod: string;
}): Promise<Order> {
  const res = await axiosInstance.post(QueryKeys.ORDERS, payload);
  return unwrapAxios<Order>(res);
}

export async function cancelOrder(id: string): Promise<Order> {
  const res = await axiosInstance.post(`${QueryKeys.ORDERS}/${id}/cancel`);
  return unwrapAxios<Order>(res);
}

/** The shopper says a refund marked as sent never arrived; an admin checks it. */
export async function reportRefundNotReceived(params: {
  orderId: string;
  refundId: string;
}): Promise<Order> {
  const res = await axiosInstance.post(
    `${QueryKeys.ORDERS}/${params.orderId}/refunds/${params.refundId}/not-received`,
  );
  return unwrapAxios<Order>(res);
}

export async function verifyOrderPayment(id: string): Promise<Order> {
  const res = await axiosInstance.post(`${QueryKeys.ORDERS}/${id}/verify-payment`);
  return unwrapAxios<Order>(res);
}

/** Public Kashia return handler — works without login. */
export async function verifyOrderPaymentReturn(
  orderId: string,
): Promise<PaymentReturnSummary> {
  const res = await axiosInstance.post(
    `${QueryKeys.ORDERS}/public/${orderId}/verify-payment`,
  );
  return unwrapAxios<PaymentReturnSummary>(res);
}

export async function createOrderPaymentLink(id: string): Promise<Order> {
  const res = await axiosInstance.post(`${QueryKeys.ORDERS}/${id}/payment-link`);
  return unwrapAxios<Order>(res);
}

export async function confirmOrderDelivery(id: string): Promise<Order> {
  const res = await axiosInstance.post(`${QueryKeys.ORDERS}/${id}/confirm-delivery`);
  return unwrapAxios<Order>(res);
}

export async function updateVendorOrderStatus(
  orderId: string,
  payload: { status: OrderStatus; description: string },
): Promise<Order> {
  const res = await axiosInstance.patch(
    `${QueryKeys.VENDOR_ORDERS}/${orderId}/status`,
    payload,
  );
  return unwrapAxios<Order>(res);
}

// --- Addresses ---
export async function fetchAddresses(): Promise<Address[]> {
  const res = await axiosInstance.get(QueryKeys.ADDRESSES);
  return unwrapAxios<Address[]>(res);
}

export async function createAddress(
  data: Omit<Address, "_id" | "userId">,
): Promise<Address> {
  const res = await axiosInstance.post(QueryKeys.ADDRESSES, data);
  return unwrapAxios<Address>(res);
}

export async function updateAddress(
  id: string,
  data: Partial<Address>,
): Promise<Address> {
  const res = await axiosInstance.patch(`${QueryKeys.ADDRESSES}/${id}`, data);
  return unwrapAxios<Address>(res);
}

export async function deleteAddress(id: string): Promise<void> {
  await axiosInstance.delete(`${QueryKeys.ADDRESSES}/${id}`);
}

export async function setDefaultAddress(id: string): Promise<Address> {
  const res = await axiosInstance.patch(
    `${QueryKeys.ADDRESSES}/${id}/default`,
  );
  return unwrapAxios<Address>(res);
}

// --- Profile ---
export async function fetchProfile(): Promise<ShopperProfile> {
  const res = await axiosInstance.get(QueryKeys.PROFILE);
  return unwrapAxios<ShopperProfile>(res);
}

export async function updateProfile(
  data: Partial<ShopperProfile>,
): Promise<ShopperProfile> {
  const res = await axiosInstance.patch(QueryKeys.PROFILE, data);
  return unwrapAxios<ShopperProfile>(res);
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await axiosInstance.patch("/users/change-password", data);
}

/**
 * Revokes every token issued to the shopper (server bumps `tokenVersion`).
 * The token is passed explicitly because the caller clears local auth state
 * straight after, before the async request interceptor would read it.
 */
export async function logoutShopper(token: string): Promise<void> {
  await axiosInstance.post("/users/logout", undefined, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateNotificationSettings(
  settings: Partial<NotificationSettings>,
): Promise<ShopperProfile> {
  const res = await axiosInstance.patch(
    "/users/notification-settings",
    settings,
  );
  return unwrapAxios<ShopperProfile>(res);
}

// --- Saved ---
export async function fetchSavedProducts(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedData<Product>> {
  const res = await axiosInstance.get(QueryKeys.SAVED_PRODUCTS, { params });
  return unwrapAxios<PaginatedData<Product>>(res);
}

export async function fetchSavedProductsGrouped(): Promise<SavedProductsByStore[]> {
  const res = await axiosInstance.get(QueryKeys.SAVED_PRODUCTS_GROUPED);
  return unwrapAxios<SavedProductsByStore[]>(res);
}

export async function saveProduct(productId: string): Promise<void> {
  await axiosInstance.patch(
    `${QueryKeys.PRODUCTS}/save-product-as-favorite/${productId}`,
  );
}

export async function unsaveProduct(productId: string): Promise<void> {
  await axiosInstance.patch(
    `${QueryKeys.PRODUCTS}/remove-product-as-favorite/${productId}`,
  );
}

export async function fetchSavedStores(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedData<Vendor>> {
  const res = await axiosInstance.get(QueryKeys.SAVED_STORES, { params });
  return unwrapAxios<PaginatedData<Vendor>>(res);
}

// --- Vendor ---
export async function fetchVendorDashboard(params?: {
  page?: number;
  limit?: number;
}): Promise<VendorDashboardData> {
  const res = await axiosInstance.get(QueryKeys.VENDOR_DASHBOARD, { params });
  return unwrapAxios<VendorDashboardData>(res);
}

export async function fetchVendorOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PaginatedData<Order>> {
  const res = await axiosInstance.get(QueryKeys.VENDOR_ORDERS, { params });
  return unwrapAxios<PaginatedData<Order>>(res);
}

export async function fetchVendorOrderById(id: string): Promise<Order> {
  const res = await axiosInstance.get(`${QueryKeys.VENDOR_ORDERS}/${id}`);
  return unwrapAxios<Order>(res);
}

export async function fetchVendorTransactions(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedData<unknown>> {
  const res = await axiosInstance.get(QueryKeys.VENDOR_TRANSACTIONS, {
    params,
  });
  return unwrapAxios(res);
}

export async function fetchVendorCustomers(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedData<unknown>> {
  const res = await axiosInstance.get(QueryKeys.VENDOR_CUSTOMERS, { params });
  return unwrapAxios(res);
}
