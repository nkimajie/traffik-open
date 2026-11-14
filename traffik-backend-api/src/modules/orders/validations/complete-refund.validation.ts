import * as Joi from "joi";
import { OrderRefundPayoutMethod } from "../enums/order-refund.enum";

export const CompleteOrderRefundValidation = Joi.object({
  method: Joi.string()
    .valid(...Object.values(OrderRefundPayoutMethod))
    .required(),
  reference: Joi.string().trim().min(4).max(100).required().messages({
    "string.min": "Enter the full payout reference",
  }),
  // Strict: the amount is a check the admin is closing the right refund, so
  // it must not be rounded or converted from a string to make it match.
  amount: Joi.number()
    .positive()
    .precision(2)
    .prefs({ convert: false })
    .required(),
  note: Joi.string().trim().max(500).allow("").optional(),
});

export const ReopenOrderRefundValidation = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required(),
});

export const ResolvePaymentAlertValidation = Joi.object({
  note: Joi.string().trim().min(5).max(500).required(),
});
