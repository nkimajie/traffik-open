import {
  EmailTemplatePayloads,
  TemplateDefinition,
} from "../interfaces/email_template.interface";
import { renderLayout } from "./layout.template";

type Payload = EmailTemplatePayloads["password-changed"];

export const passwordChangedTemplate: TemplateDefinition<Payload> = {
  subject: () => "Your Traffik password was changed",
  html: (data) =>
    renderLayout({
      title: "Password updated",
      preheader: "Your Traffik account password was changed",
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${data.name},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Your Traffik password was changed on ${data.changedAt}.</p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">If this wasn't you, contact us immediately at ${data.supportEmail}.</p>
      `,
    }),
  text: (data) =>
    `Hi ${data.name}, your Traffik password was changed on ${data.changedAt}. If this wasn't you, contact ${data.supportEmail}.`,
};
