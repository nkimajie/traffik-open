export interface KashiaWebhookPayload {
  event: string;
  data: KashiaWebhookData;
  timestamp: string;
  webhook_id: string;
}

export interface KashiaWebhookData {
  id?: string;
  reference?: string;
  status?: string;
  amount?: number;
  currency?: string;
  platform_fee?: number;
  merchant_fee?: number;
  total_fees?: number;
  total_amount?: number;
  seller_amount?: number;
  metadata?: Record<string, string | undefined>;
  delivery?: Record<string, unknown>;
  [key: string]: unknown;
}
