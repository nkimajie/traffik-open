import {
  EmailTemplatePayloads,
  TemplateDefinition,
} from "../interfaces/email_template.interface";
import { renderLayout } from "./layout.template";

type Payload = EmailTemplatePayloads["welcome"];

export const welcomeTemplate: TemplateDefinition<Payload> = {
  subject: () => "Welcome to Traffik",
  html: (data) =>
    renderLayout({
      title: "Welcome to Traffik",
      preheader: "Start shopping Nigeria's major markets with escrow protection",
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${data.name},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Your account is ready. Browse verified market stores across Nigeria — from Balogun to Ariaria — with Kashia escrow on every order.</p>
      `,
      ctaLabel: "Start shopping",
      ctaUrl: data.ctaUrl,
    }),
  text: (data) =>
    `Hi ${data.name}, welcome to Traffik. Start shopping at ${data.ctaUrl}.`,
};
