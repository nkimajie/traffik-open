import {
  EmailTemplatePayloads,
  TemplateDefinition,
} from "../interfaces/email_template.interface";
import { renderLayout } from "./layout.template";

type Payload = EmailTemplatePayloads["vendor-kyc-approved"];

export const vendorKycApprovedTemplate: TemplateDefinition<Payload> = {
  subject: () => "Your Traffik store is approved",
  html: (data) =>
    renderLayout({
      title: "Store approved",
      preheader: "Your Traffik vendor account has been approved",
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${data.vendorName},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Great news — your store has been approved. You can now list products, receive orders, and get paid through Kashia escrow.</p>
      `,
      ctaLabel: "Go to dashboard",
      ctaUrl: data.dashboardUrl,
    }),
  text: (data) =>
    `Hi ${data.vendorName}, your Traffik store is approved. Dashboard: ${data.dashboardUrl}`,
};
