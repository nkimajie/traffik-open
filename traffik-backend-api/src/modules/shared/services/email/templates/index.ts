import { EmailTemplate } from "../enums/email_template.enum";
import {
  EmailTemplatePayloads,
  TemplateDefinition,
} from "../interfaces/email_template.interface";
import { otpVerificationTemplate } from "./otp-verification.template";
import { passwordResetTemplate } from "./password-reset.template";
import { passwordChangedTemplate } from "./password-changed.template";
import { welcomeTemplate } from "./welcome.template";
import { orderConfirmationTemplate } from "./order-confirmation.template";
import { orderStatusUpdateTemplate } from "./order-status-update.template";
import { refundSentTemplate } from "./refund-sent.template";
import { vendorNewOrderTemplate } from "./vendor-new-order.template";
import { vendorKycApprovedTemplate } from "./vendor-kyc-approved.template";
import { vendorKycRejectedTemplate } from "./vendor-kyc-rejected.template";

export const emailTemplateRegistry: {
  [K in EmailTemplate]: TemplateDefinition<EmailTemplatePayloads[K]>;
} = {
  [EmailTemplate.OTP_VERIFICATION]: otpVerificationTemplate,
  [EmailTemplate.PASSWORD_RESET]: passwordResetTemplate,
  [EmailTemplate.PASSWORD_CHANGED]: passwordChangedTemplate,
  [EmailTemplate.WELCOME]: welcomeTemplate,
  [EmailTemplate.ORDER_CONFIRMATION]: orderConfirmationTemplate,
  [EmailTemplate.ORDER_STATUS_UPDATE]: orderStatusUpdateTemplate,
  [EmailTemplate.REFUND_SENT]: refundSentTemplate,
  [EmailTemplate.VENDOR_NEW_ORDER]: vendorNewOrderTemplate,
  [EmailTemplate.VENDOR_KYC_APPROVED]: vendorKycApprovedTemplate,
  [EmailTemplate.VENDOR_KYC_REJECTED]: vendorKycRejectedTemplate,
};
