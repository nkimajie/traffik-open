import {
  EmailTemplatePayloads,
  TemplateDefinition,
} from "../interfaces/email_template.interface";
import { formatNaira, renderLayout, renderOrderItemsTable } from "./layout.template";

type Payload = EmailTemplatePayloads["order-confirmation"];

export const orderConfirmationTemplate: TemplateDefinition<Payload> = {
  subject: (data) => `Order ${data.orderRef} confirmed`,
  html: (data) =>
    renderLayout({
      title: "Thanks for your order",
      preheader: `Order ${data.orderRef} is confirmed`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${data.name},</p>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">We've received your order <strong>${data.orderRef}</strong>. Your payment is held in Kashia escrow until delivery is confirmed.</p>
        ${renderOrderItemsTable(data.items)}
        <p style="margin:16px 0 0;font-size:16px;font-weight:700;color:#030803;text-align:right;">Total: ${formatNaira(data.total)}</p>
      `,
      ctaLabel: "View order",
      ctaUrl: data.orderUrl,
    }),
  text: (data) => {
    const lines = data.items
      .map((item) => `- ${item.name} x${item.quantity}: ${formatNaira(item.price)}`)
      .join("\n");
    return `Hi ${data.name}, order ${data.orderRef} is confirmed.\n${lines}\nTotal: ${formatNaira(data.total)}\nView: ${data.orderUrl}`;
  },
};
