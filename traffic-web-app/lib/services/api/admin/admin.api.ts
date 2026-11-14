import axiosInstance from "../../config/axios-instance";
import { unwrapAxios } from "../../config/unwrap-response";
import { isAxiosError } from "axios";
import type {
  Category,
  Order,
  OrderRefundPayoutMethod,
  OrderRefundStatus,
  OrderStatus,
  PaginatedData,
  VendorSummary,
} from "@/lib/types/api";

export interface AdminStoreItem {
  _id: string;
  businessName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  storeLogo?: string;
  storeCoverPhoto?: string;
  businessCategory?: string;
  totalItemsSold: number;
  totalOrders: number;
  isApproved: boolean;
  isActive: boolean;
  createdAt?: string;
}

export interface AdminStoresResponse {
  topStores: AdminStoreItem[];
  allStores: AdminStoreItem[];
  meta: PaginatedData<AdminStoreItem>["meta"];
}

export interface VendorKycRecord {
  _id: string;
  vendor: VendorSummary & {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  bankName: string;
  accountNumber: string;
  dob: string;
  bvn: string;
  status: "pending" | "approved" | "rejected";
  notes?: string | null;
  createdAt?: string;
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
}

export interface CreateVoucherPayload {
  name: string;
  code: string;
  percentage: number;
  expiringDate: string;
}

export interface Voucher {
  _id: string;
  name: string;
  code: string;
  percentage: number;
  expiringDate: string;
  createdAt?: string;
}

function wrapError(error: unknown, fallback: string): never {
  if (isAxiosError(error) && error.response) {
    throw new Error(error.response.data?.message || fallback);
  }
  throw new Error(fallback);
}

export async function fetchAdminStores(params?: {
  page?: number;
  limit?: number;
  approved?: boolean;
}): Promise<AdminStoresResponse> {
  try {
    const res = await axiosInstance.get("/vendors/admin/all-stores", {
      params,
    });
    return unwrapAxios<AdminStoresResponse>(res);
  } catch (error) {
    wrapError(error, "Failed to load stores");
  }
}

export async function updateVendorApproval(
  vendorId: string,
  payload: { status: "approved" | "rejected"; notes?: string },
): Promise<AdminStoreItem> {
  try {
    const res = await axiosInstance.patch(
      `/vendors/admin/${vendorId}/approval`,
      payload,
    );
    return unwrapAxios<AdminStoreItem>(res);
  } catch (error) {
    wrapError(error, "Failed to update vendor approval");
  }
}

export async function fetchAdminKycQueue(params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedData<VendorKycRecord>> {
  try {
    const res = await axiosInstance.get("/vendors/kyc/admin", { params });
    return unwrapAxios<PaginatedData<VendorKycRecord>>(res);
  } catch (error) {
    wrapError(error, "Failed to load KYC queue");
  }
}

export async function updateKycStatus(
  kycId: string,
  payload: { status: "approved" | "rejected"; notes?: string },
): Promise<VendorKycRecord> {
  try {
    const res = await axiosInstance.patch(
      `/vendors/kyc/admin/${kycId}/status`,
      payload,
    );
    return unwrapAxios<VendorKycRecord>(res);
  } catch (error) {
    wrapError(error, "Failed to update KYC status");
  }
}

export async function fetchAdminOrders(params?: {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  /** Only orders with a refund in this state; REQUIRED = refunds still to make. */
  refundStatus?: OrderRefundStatus;
  /** OPEN: only orders with a payment alert not yet resolved. */
  alerts?: "OPEN";
}): Promise<PaginatedData<Order>> {
  try {
    const res = await axiosInstance.get("/orders/admin", { params });
    return unwrapAxios<PaginatedData<Order>>(res);
  } catch (error) {
    wrapError(error, "Failed to load orders");
  }
}

export async function updateAdminOrderStatus(
  orderId: string,
  payload: { status: OrderStatus; description?: string },
): Promise<Order> {
  try {
    const res = await axiosInstance.patch(`/orders/${orderId}/status`, payload);
    return unwrapAxios<Order>(res);
  } catch (error) {
    wrapError(error, "Failed to update order status");
  }
}

/**
 * Records a refund made by hand. The amount must equal the refund amount and
 * the reference can back only one refund; the shopper is emailed it.
 */
export async function completeAdminOrderRefund(
  orderId: string,
  refundId: string,
  payload: {
    method: OrderRefundPayoutMethod;
    reference: string;
    amount: number;
    note?: string;
  },
): Promise<Order> {
  try {
    const res = await axiosInstance.post(
      `/orders/${orderId}/refunds/${refundId}/complete`,
      payload,
    );
    return unwrapAxios<Order>(res);
  } catch (error) {
    wrapError(error, "Failed to mark refund as completed");
  }
}

/** Puts a refund completed by hand back in the queue (e.g. marked by mistake). */
export async function reopenAdminOrderRefund(
  orderId: string,
  refundId: string,
  payload: { reason: string },
): Promise<Order> {
  try {
    const res = await axiosInstance.post(
      `/orders/${orderId}/refunds/${refundId}/reopen`,
      payload,
    );
    return unwrapAxios<Order>(res);
  } catch (error) {
    wrapError(error, "Failed to reopen refund");
  }
}

/** Records how a payment alert (escrow and order disagreeing) was dealt with. */
export async function resolveAdminPaymentAlert(
  orderId: string,
  alertId: string,
  payload: { note: string },
): Promise<Order> {
  try {
    const res = await axiosInstance.post(
      `/orders/${orderId}/alerts/${alertId}/resolve`,
      payload,
    );
    return unwrapAxios<Order>(res);
  } catch (error) {
    wrapError(error, "Failed to resolve alert");
  }
}

export async function createCategory(
  payload: CreateCategoryPayload,
): Promise<Category> {
  try {
    const res = await axiosInstance.post("/categories", payload);
    return unwrapAxios<Category>(res);
  } catch (error) {
    wrapError(error, "Failed to create category");
  }
}

export async function createVoucher(
  payload: CreateVoucherPayload,
): Promise<Voucher> {
  try {
    const res = await axiosInstance.post("/vouchers", payload);
    return unwrapAxios<Voucher>(res);
  } catch (error) {
    wrapError(error, "Failed to create voucher");
  }
}

export async function fetchVouchers(): Promise<Voucher[]> {
  try {
    const res = await axiosInstance.get("/vouchers");
    return unwrapAxios<Voucher[]>(res);
  } catch (error) {
    wrapError(error, "Failed to load vouchers");
  }
}

export type EmailTemplateId =
  | "otp-verification"
  | "password-reset"
  | "password-changed"
  | "welcome"
  | "order-confirmation"
  | "order-status-update"
  | "refund-sent"
  | "vendor-new-order"
  | "vendor-kyc-approved"
  | "vendor-kyc-rejected";

export interface EmailTemplateItem {
  id: EmailTemplateId;
  label: string;
  description: string;
}

export interface EmailConfigStatus {
  configured: boolean;
  fromEmail?: string;
  fromName?: string;
}

export interface SendTestEmailPayload {
  to: string;
  template: EmailTemplateId;
}

export interface SendTestEmailResult {
  to: string;
  template: EmailTemplateId;
  subject: string;
  sentAt: string;
}

export async function fetchEmailTemplates(): Promise<EmailTemplateItem[]> {
  try {
    const res = await axiosInstance.get("/admin/email/templates");
    return unwrapAxios<EmailTemplateItem[]>(res);
  } catch (error) {
    wrapError(error, "Failed to load email templates");
  }
}

export async function fetchEmailConfig(): Promise<EmailConfigStatus> {
  try {
    const res = await axiosInstance.get("/admin/email/config");
    return unwrapAxios<EmailConfigStatus>(res);
  } catch (error) {
    wrapError(error, "Failed to load email configuration");
  }
}

export async function sendTestEmail(
  payload: SendTestEmailPayload,
): Promise<SendTestEmailResult> {
  try {
    const res = await axiosInstance.post("/admin/email/test", payload);
    return unwrapAxios<SendTestEmailResult>(res);
  } catch (error) {
    wrapError(error, "Failed to send test email");
  }
}

export interface PlatformSettings {
  commissionPercentage: number;
  updatedAt?: string;
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  try {
    const res = await axiosInstance.get("/admin/settings");
    return unwrapAxios<PlatformSettings>(res);
  } catch (error) {
    wrapError(error, "Failed to load platform settings");
  }
}

export async function updatePlatformSettings(payload: {
  commissionPercentage: number;
}): Promise<PlatformSettings> {
  try {
    const res = await axiosInstance.patch("/admin/settings", payload);
    return unwrapAxios<PlatformSettings>(res);
  } catch (error) {
    wrapError(error, "Failed to update platform settings");
  }
}
