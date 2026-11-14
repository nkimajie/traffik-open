import {
  EmailTemplatePayloads,
  TemplateDefinition,
} from "../interfaces/email_template.interface";
import { formatNaira, renderLayout } from "./layout.template";

type Payload = EmailTemplatePayloads["vendor-new-order"];

export const vendorNewOrderTemplate: TemplateDefinition<Payload> = {
  subject: (data) => `New order ${data.orderRef}`,
  html: (data) =>
    renderLayout({
      title: "You have a new order",
      preheader: `${data.customerName} placed order ${data.orderRef}`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${data.vendorName},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${data.customerName} placed a new order. Review the details and start processing when you're ready.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;">
          <tr><td style="padding:12px 16px;font-size:14px;"><strong>Order:</strong> ${data.orderRef}</td></tr>
          <tr><td style="padding:0 16px 12px;font-size:14px;"><strong>Items:</strong> ${data.itemCount}</td></tr>
          <tr><td style="padding:0 16px 16px;font-size:14px;"><strong>Total:</strong> ${formatNaira(data.total)}</td></tr>
        </table>
      `,
      ctaLabel: "View in dashboard",
      ctaUrl: data.dashboardUrl,
    }),
  text: (data) =>
    `Hi ${data.vendorName}, new order ${data.orderRef} from ${data.customerName}. ${data.itemCount} item(s), total ${formatNaira(data.total)}. Dashboard: ${data.dashboardUrl}`,
};
