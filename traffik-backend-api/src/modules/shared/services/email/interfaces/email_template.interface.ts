import { OrderStatus } from "../../../../orders/enums/order.enum";
import { EmailTemplate } from "../enums/email_template.enum";

export interface EmailOrderLine {
  name: string;
  quantity: number;
  price: number;
}

export interface EmailTemplatePayloads {
  [EmailTemplate.OTP_VERIFICATION]: {
    name: string;
    otp: string;
    expiresInMinutes: number;
  };
  [EmailTemplate.PASSWORD_RESET]: {
    name: string;
    resetUrl: string;
    expiresInMinutes: number;
  };
  [EmailTemplate.PASSWORD_CHANGED]: {
    name: string;
    changedAt: string;
    supportEmail: string;
  };
  [EmailTemplate.WELCOME]: {
    name: string;
    ctaUrl: string;
  };
  [EmailTemplate.ORDER_CONFIRMATION]: {
    name: string;
    orderRef: string;
    items: EmailOrderLine[];
    total: number;
    orderUrl: string;
  };
  [EmailTemplate.ORDER_STATUS_UPDATE]: {
    name: string;
    orderRef: string;
    status: OrderStatus;
    statusLabel: string;
    orderUrl: string;
    note?: string;
  };
  [EmailTemplate.REFUND_SENT]: {
    name: string;
    orderRef: string;
    /** Naira. */
    amount: number;
    methodLabel: string;
    reference: string;
    note?: string;
    orderUrl: string;
    reportWindowDays: number;
  };
  [EmailTemplate.VENDOR_NEW_ORDER]: {
    vendorName: string;
    orderRef: string;
    customerName: string;
    itemCount: number;
    total: number;
    dashboardUrl: string;
  };
  [EmailTemplate.VENDOR_KYC_APPROVED]: {
    vendorName: string;
    dashboardUrl: string;
  };
  [EmailTemplate.VENDOR_KYC_REJECTED]: {
    vendorName: string;
    reason?: string;
    supportEmail: string;
  };
}

export interface TemplateDefinition<T> {
  subject: (data: T) => string;
  html: (data: T) => string;
  text: (data: T) => string;
}

export interface SendEmailParams<T extends EmailTemplate> {
  to: string | string[];
  template: T;
  data: EmailTemplatePayloads[T];
  cc?: string[];
  replyTo?: string;
}
