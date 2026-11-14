import {
  EmailTemplatePayloads,
  TemplateDefinition,
} from "../interfaces/email_template.interface";
import { escapeHtml, formatNaira, renderLayout } from "./layout.template";

type Payload = EmailTemplatePayloads["refund-sent"];

/**
 * Tells the shopper a refund was marked as sent, with the reference to look
 * for. The shopper is the one who can tell whether the money really arrived,
 * so the email says how to report it if not.
 */
export const refundSentTemplate: TemplateDefinition<Payload> = {
  subject: (data) => `Your refund for order ${data.orderRef} has been sent`,
  html: (data) => {
    const note = data.note
      ? `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#6B7280;">${escapeHtml(data.note)}</p>`
      : "";

    return renderLayout({
      title: "Refund sent",
      preheader: `${formatNaira(data.amount)} is on its way back to you`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(data.name)},</p>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">We've sent your refund of <strong>${escapeHtml(formatNaira(data.amount))}</strong> for order <strong>${escapeHtml(data.orderRef)}</strong>.</p>
        <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">Method: ${escapeHtml(data.methodLabel)}<br />Reference: <strong>${escapeHtml(data.reference)}</strong></p>
        ${note}
        <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#6B7280;">If it hasn't reached you within a few working days, let us know from your order page within ${data.reportWindowDays} days and we'll look into it.</p>
      `,
      ctaLabel: "View order",
      ctaUrl: data.orderUrl,
    });
  },
  text: (data) =>
    `Hi ${data.name}, we've sent your refund of ${formatNaira(data.amount)} for order ${data.orderRef} (${data.methodLabel}, reference ${data.reference}).${data.note ? ` ${data.note}` : ""} If it hasn't arrived within a few working days, report it from your order page within ${data.reportWindowDays} days: ${data.orderUrl}`,
};
