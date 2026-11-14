import { Injectable, Logger } from "@nestjs/common";
import { Config } from "../../../../config/configuration";
import * as nodemailer from "nodemailer";
import { EmailTemplate } from "./enums/email_template.enum";
import {
  EmailTemplatePayloads,
  SendEmailParams,
} from "./interfaces/email_template.interface";
import { emailTemplateRegistry } from "./templates";

interface SendOtpEmailParams {
  to: string;
  name: string;
  otp: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  /**
   * Built once and reused so warm Lambda invocations skip the TLS handshake.
   * Pooling stays off because a frozen container cannot service a pool.
   */
  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    const encryption = (
      Config.getValue("SMTP_ENCRYPTION") || "tls"
    ).toLowerCase();

    this.transporter = nodemailer.createTransport({
      host: Config.getValue("SMTP_HOST"),
      port: Number(Config.getValue("SMTP_PORT")) || 587,
      // Port 465 negotiates TLS immediately; 587 starts plaintext and upgrades.
      secure: encryption === "ssl",
      requireTLS: encryption === "tls",
      auth: {
        user: Config.getValue("SMTP_USER"),
        pass: Config.getValue("SMTP_PASSWORD"),
      },
    });

    return this.transporter;
  }

  private getFromAddress(): string {
    const name = Config.getValue("SMTP_FROM_NAME") || "Traffik";
    const email =
      Config.getValue("SMTP_FROM_EMAIL") || Config.getValue("SMTP_USER");
    return `"${name}" <${email}>`;
  }

  async send<T extends EmailTemplate>(params: SendEmailParams<T>): Promise<void> {
    const definition = emailTemplateRegistry[params.template];
    const subject = definition.subject(params.data);
    const html = definition.html(params.data);
    const text = definition.text(params.data);

    await this.getTransporter().sendMail({
      from: this.getFromAddress(),
      to: params.to,
      cc: params.cc,
      replyTo: params.replyTo,
      subject,
      html,
      text,
    });

    this.logger.log(
      `Email sent: template=${params.template} to=${Array.isArray(params.to) ? params.to.join(",") : params.to}`,
    );
  }

  /** Logs and swallows errors — use for non-critical notifications. */
  async sendSafe<T extends EmailTemplate>(
    params: SendEmailParams<T>,
  ): Promise<boolean> {
    try {
      await this.send(params);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Email failed: template=${params.template} to=${Array.isArray(params.to) ? params.to.join(",") : params.to} — ${message}`,
      );
      return false;
    }
  }

  /** @deprecated Use send({ template: EmailTemplate.OTP_VERIFICATION, ... }) */
  async sendOtpEmail({ to, name, otp }: SendOtpEmailParams): Promise<void> {
    await this.send({
      to,
      template: EmailTemplate.OTP_VERIFICATION,
      data: { name, otp, expiresInMinutes: 60 },
    });
  }
}
