import {
  EmailTemplatePayloads,
  TemplateDefinition,
} from "../interfaces/email_template.interface";
import { renderLayout } from "./layout.template";

type Payload = EmailTemplatePayloads["vendor-kyc-rejected"];

export const vendorKycRejectedTemplate: TemplateDefinition<Payload> = {
  subject: () => "Update on your Traffik store application",
  html: (data) => {
    const reason = data.reason
      ? `<p style="margin:12px 0 0;padding:12px 16px;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;font-size:14px;line-height:1.6;color:#991B1B;"><strong>Reason:</strong> ${data.reason}</p>`
      : "";

    return renderLayout({
      title: "Store application update",
      preheader: "Your Traffik vendor application needs attention",
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${data.vendorName},</p>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">We couldn't approve your store application at this time. Please review the details below and contact support if you need help.</p>
        ${reason}
        <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#6B7280;">Support: ${data.supportEmail}</p>
      `,
    });
  },
  text: (data) =>
    `Hi ${data.vendorName}, your Traffik store application was not approved.${data.reason ? ` Reason: ${data.reason}.` : ""} Contact ${data.supportEmail}.`,
};
