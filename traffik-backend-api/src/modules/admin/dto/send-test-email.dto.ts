import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { EmailTemplate } from "../../shared/services/email/enums/email_template.enum";

export class SendTestEmailDto {
  @ApiProperty({
    example: "admin@example.com",
    description:
      "Recipient inbox for the test send. Use your own address or a staging alias — the platform does not restrict this to admin accounts.",
  })
  to: string;

  @ApiProperty({
    enum: EmailTemplate,
    example: EmailTemplate.WELCOME,
    description:
      "Which transactional template to render. Sample fixture data is injected automatically; you only choose the template id.",
  })
  template: EmailTemplate;
}

export class EmailTemplateListItemDto {
  @ApiProperty({
    enum: EmailTemplate,
    example: EmailTemplate.ORDER_CONFIRMATION,
    description: "Stable template id passed to `POST /admin/email/test`.",
  })
  id: EmailTemplate;

  @ApiProperty({
    example: "Order confirmation",
    description: "Human-readable label shown in the admin settings picker.",
  })
  label: string;

  @ApiProperty({
    example: "Shopper receipt after checkout.",
    description: "Short explanation of when the platform sends this template in production.",
  })
  description: string;
}

export class EmailConfigStatusDto {
  @ApiProperty({
    example: true,
    description:
      "Whether `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASSWORD` are all set. When false, test sends will fail until env vars are configured.",
  })
  configured: boolean;

  @ApiPropertyOptional({
    example: "noreply@traffik.ng",
    description:
      "From-address used for outbound mail (`SMTP_FROM_EMAIL`, falling back to `SMTP_USER`). Never includes credentials.",
  })
  fromEmail?: string;

  @ApiPropertyOptional({
    example: "Traffik",
    description: "Display name paired with the from-address (`SMTP_FROM_NAME`).",
  })
  fromName?: string;
}

export class SendTestEmailResultDto {
  @ApiProperty({ example: "admin@example.com" })
  to: string;

  @ApiProperty({
    enum: EmailTemplate,
    example: EmailTemplate.WELCOME,
  })
  template: EmailTemplate;

  @ApiProperty({
    example: "Welcome to Traffik",
    description: "Resolved subject line from the template definition.",
  })
  subject: string;

  @ApiProperty({
    example: "2026-07-29T12:00:00.000Z",
    description: "UTC timestamp recorded when the send completed.",
  })
  sentAt: string;
}
