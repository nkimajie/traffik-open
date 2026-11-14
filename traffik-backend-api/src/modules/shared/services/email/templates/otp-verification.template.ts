import {
  EmailTemplatePayloads,
  TemplateDefinition,
} from "../interfaces/email_template.interface";
import { EmailTemplate } from "../enums/email_template.enum";
import { renderLayout } from "./layout.template";

type Payload = EmailTemplatePayloads[EmailTemplate.OTP_VERIFICATION];

export const otpVerificationTemplate: TemplateDefinition<Payload> = {
  subject: () => "Verify your Traffik account",
  html: (data) =>
    renderLayout({
      title: "Verify your email",
      preheader: `Your Traffik verification code is ${data.otp}`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${data.name},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Use the code below to verify your email address and activate your Traffik account.</p>
        <p style="margin:0;padding:16px 20px;background:#F3F4F6;border-radius:8px;font-size:28px;font-weight:700;letter-spacing:6px;text-align:center;color:#030803;">${data.otp}</p>
        <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#6B7280;">This code expires in ${data.expiresInMinutes} minutes. If you did not request this, you can ignore this email.</p>
      `,
    }),
  text: (data) =>
    `Hi ${data.name}, your Traffik verification code is ${data.otp}. It expires in ${data.expiresInMinutes} minutes.`,
};
