import {
  EmailTemplatePayloads,
  TemplateDefinition,
} from "../interfaces/email_template.interface";
import { renderLayout } from "./layout.template";

type Payload = EmailTemplatePayloads["order-status-update"];

export const orderStatusUpdateTemplate: TemplateDefinition<Payload> = {
  subject: (data) => `Order ${data.orderRef} — ${data.statusLabel}`,
  html: (data) => {
    const note = data.note
      ? `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#6B7280;">${data.note}</p>`
      : "";

    return renderLayout({
      title: `Order ${data.statusLabel.toLowerCase()}`,
      preheader: `Your order ${data.orderRef} is now ${data.statusLabel.toLowerCase()}`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${data.name},</p>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Your order <strong>${data.orderRef}</strong> is now <strong>${data.statusLabel}</strong>.</p>
        ${note}
      `,
      ctaLabel: "Track order",
      ctaUrl: data.orderUrl,
    });
  },
  text: (data) =>
    `Hi ${data.name}, order ${data.orderRef} is now ${data.statusLabel}.${data.note ? ` ${data.note}` : ""} Track: ${data.orderUrl}`,
};
