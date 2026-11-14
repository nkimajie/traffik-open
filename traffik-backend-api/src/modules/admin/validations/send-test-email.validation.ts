import * as Joi from "joi";
import { EmailTemplate } from "../../shared/services/email/enums/email_template.enum";

export const SendTestEmailValidation = Joi.object({
  to: Joi.string().email().required().messages({
    "string.email": "Please provide a valid recipient email",
    "any.required": "Recipient email is required",
  }),
  template: Joi.string()
    .valid(...Object.values(EmailTemplate))
    .required()
    .messages({
      "any.only": "Invalid email template",
      "any.required": "Email template is required",
    }),
});
