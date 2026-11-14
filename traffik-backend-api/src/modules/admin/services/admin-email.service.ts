import { Injectable, Logger } from "@nestjs/common";
import { Config } from "../../../config/configuration";
import { EmailService } from "../../shared/services/email/email.service";
import { EmailTemplate } from "../../shared/services/email/enums/email_template.enum";
import {
  buildEmailTestPayload,
  EMAIL_TEMPLATE_CATALOG,
  previewEmailTemplate,
} from "../../shared/services/email/email-test.fixtures";

@Injectable()
export class AdminEmailService {
  private readonly logger = new Logger(AdminEmailService.name);

  constructor(private readonly emailService: EmailService) {}

  listTemplates() {
    return EMAIL_TEMPLATE_CATALOG;
  }

  getConfigStatus() {
    const host = Config.getValue("SMTP_HOST");
    const user = Config.getValue("SMTP_USER");
    const password = Config.getValue("SMTP_PASSWORD");

    return {
      configured: Boolean(host && user && password),
      fromEmail:
        Config.getValue("SMTP_FROM_EMAIL") || Config.getValue("SMTP_USER"),
      fromName: Config.getValue("SMTP_FROM_NAME") || "Traffik",
    };
  }

  async sendTestEmail(to: string, template: EmailTemplate) {
    const data = buildEmailTestPayload(template);
    const preview = previewEmailTemplate(template, data);

    try {
      await this.emailService.send({
        to,
        template,
        data,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Test email failed: template=${template} to=${to} — ${message}`);
      throw error;
    }

    return {
      to,
      template,
      subject: preview.subject,
      sentAt: new Date().toISOString(),
    };
  }
}
