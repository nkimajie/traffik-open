import { OrderStatus } from "../../../orders/enums/order.enum";
import { EmailTemplate } from "./enums/email_template.enum";
import {
  EmailTemplatePayloads,
  TemplateDefinition,
} from "./interfaces/email_template.interface";
import {
  getAppWebUrl,
  getOrderStatusLabel,
  getSupportEmail,
} from "./email.helpers";
import { emailTemplateRegistry } from "./templates";

export interface EmailTemplateCatalogItem {
  id: EmailTemplate;
  label: string;
  description: string;
}

export const EMAIL_TEMPLATE_CATALOG: EmailTemplateCatalogItem[] = [
  {
    id: EmailTemplate.OTP_VERIFICATION,
    label: "OTP verification",
    description: "One-time code sent during email verification.",
  },
  {
    id: EmailTemplate.PASSWORD_RESET,
    label: "Password reset",
    description: "Link to reset a forgotten password.",
  },
  {
    id: EmailTemplate.PASSWORD_CHANGED,
    label: "Password changed",
    description: "Confirmation after a password update.",
  },
  {
    id: EmailTemplate.WELCOME,
    label: "Welcome",
    description: "Sent when a new shopper or vendor account is created.",
  },
  {
    id: EmailTemplate.ORDER_CONFIRMATION,
    label: "Order confirmation",
    description: "Shopper receipt after checkout.",
  },
  {
    id: EmailTemplate.ORDER_STATUS_UPDATE,
    label: "Order status update",
    description: "Shopper notification when an order moves status.",
  },
  {
    id: EmailTemplate.REFUND_SENT,
    label: "Refund sent",
    description:
      "Shopper notice that a refund was sent, with the payout reference.",
  },
  {
    id: EmailTemplate.VENDOR_NEW_ORDER,
    label: "Vendor new order",
    description: "Alert to a store when a new order arrives.",
  },
  {
    id: EmailTemplate.VENDOR_KYC_APPROVED,
    label: "Vendor KYC approved",
    description: "Store approval confirmation for vendors.",
  },
  {
    id: EmailTemplate.VENDOR_KYC_REJECTED,
    label: "Vendor KYC rejected",
    description: "Store rejection notice with optional reason.",
  },
];

export function buildEmailTestPayload<T extends EmailTemplate>(
  template: T,
): EmailTemplatePayloads[T] {
  const samples: EmailTemplatePayloads = {
    [EmailTemplate.OTP_VERIFICATION]: {
      name: "Test User",
      otp: "482910",
      expiresInMinutes: 60,
    },
    [EmailTemplate.PASSWORD_RESET]: {
      name: "Test User",
      resetUrl: getAppWebUrl("/forgot-password?token=test-token"),
      expiresInMinutes: 30,
    },
    [EmailTemplate.PASSWORD_CHANGED]: {
      name: "Test User",
      changedAt: new Date().toISOString(),
      supportEmail: getSupportEmail(),
    },
    [EmailTemplate.WELCOME]: {
      name: "Test User",
      ctaUrl: getAppWebUrl("/account"),
    },
    [EmailTemplate.ORDER_CONFIRMATION]: {
      name: "Test Shopper",
      orderRef: "TRF-000042",
      items: [
        { name: "Ankara Fabric (6 yards)", quantity: 1, price: 18500 },
        { name: "Delivery", quantity: 1, price: 1500 },
      ],
      total: 20000,
      orderUrl: getAppWebUrl("/account/orders/test-order-id"),
    },
    [EmailTemplate.ORDER_STATUS_UPDATE]: {
      name: "Test Shopper",
      orderRef: "TRF-000042",
      status: OrderStatus.SHIPPED,
      statusLabel: getOrderStatusLabel(OrderStatus.SHIPPED),
      orderUrl: getAppWebUrl("/account/orders/test-order-id"),
      note: "Your order is on the way.",
    },
    [EmailTemplate.REFUND_SENT]: {
      name: "Test Shopper",
      orderRef: "TRF-000042",
      amount: 20000,
      methodLabel: "Bank transfer",
      reference: "FT26315XYZ",
      note: "Refunded to the account you paid from.",
      orderUrl: getAppWebUrl("/account/orders/test-order-id"),
      reportWindowDays: 30,
    },
    [EmailTemplate.VENDOR_NEW_ORDER]: {
      vendorName: "Test Store",
      orderRef: "TRF-000042",
      customerName: "Test Shopper",
      itemCount: 2,
      total: 20000,
      dashboardUrl: getAppWebUrl("/dashboard/orders/test-order-id"),
    },
    [EmailTemplate.VENDOR_KYC_APPROVED]: {
      vendorName: "Test Store",
      dashboardUrl: getAppWebUrl("/dashboard"),
    },
    [EmailTemplate.VENDOR_KYC_REJECTED]: {
      vendorName: "Test Store",
      reason: "Sample rejection reason for testing.",
      supportEmail: getSupportEmail(),
    },
  };

  return samples[template];
}

export function previewEmailTemplate<T extends EmailTemplate>(
  template: T,
  data: EmailTemplatePayloads[T],
): { subject: string; html: string; text: string } {
  const definition = emailTemplateRegistry[
    template
  ] as TemplateDefinition<EmailTemplatePayloads[T]>;

  return {
    subject: definition.subject(data),
    html: definition.html(data),
    text: definition.text(data),
  };
}
