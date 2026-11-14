import {
  EmailTemplatePayloads,
  TemplateDefinition,
} from "../interfaces/email_template.interface";
import { renderLayout } from "./layout.template";

type Payload = EmailTemplatePayloads["password-reset"];

export const passwordResetTemplate: TemplateDefinition<Payload> = {
  subject: () => "Reset your Traffik password",
  html: (data) =>
    renderLayout({
      title: "Reset your password",
      preheader: "Use the link below to reset your Traffik password",
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${data.name},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">We received a request to reset your password. Click the button below to choose a new one.</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">This link expires in ${data.expiresInMinutes} minutes. If you did not request a reset, you can safely ignore this email.</p>
      `,
      ctaLabel: "Reset password",
      ctaUrl: data.resetUrl,
    }),
  text: (data) =>
    `Hi ${data.name}, reset your Traffik password here: ${data.resetUrl} (expires in ${data.expiresInMinutes} minutes).`,
};
