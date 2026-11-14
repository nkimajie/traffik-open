export interface KashiaApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface KashiaCustomer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  phone_number?: string | null;
  is_new: boolean;
}

export interface CreateKashiaCustomerPayload {
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  phone_number?: string;
}

export interface KashiaPaymentLinkFees {
  platform_fee: number;
  merchant_fee: number;
  total_fees: number;
  total_amount: number;
}

export interface KashiaPaymentLink {
  id: string;
  reference: string;
  payment_url: string;
  title: string;
  amount: number;
  currency: string;
  fees: KashiaPaymentLinkFees;
  /** active | completed | expired | cancelled */
  status: string;
  expires_at?: string | null;
  created_at: string;
  escrow_id?: string;
  escrow_status?: string;
}

export interface CreateKashiaPaymentLinkPayload {
  buyer_user_id: string;
  seller_user_id?: string;
  title: string;
  description?: string;
  amount: number;
  currency?: string;
  merchant_fee_percentage?: number;
  merchant_fee_cap?: number;
  metadata?: Record<string, string>;
  redirect_url?: string;
}
