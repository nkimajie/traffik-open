import * as Joi from "joi";

export const CreateVoucherValidation = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    "string.min": "Voucher name must be at least 2 characters long",
    "string.max": "Voucher name cannot exceed 100 characters",
    "any.required": "Voucher name is required",
  }),
  code: Joi.string().min(3).max(20).required().messages({
    "string.min": "Voucher code must be at least 3 characters long",
    "string.max": "Voucher code cannot exceed 20 characters",
    "any.required": "Voucher code is required",
  }),
  percentage: Joi.number().min(0).max(100).required().messages({
    "number.min": "Percentage must be at least 0",
    "number.max": "Percentage cannot exceed 100",
    "any.required": "Percentage is required",
  }),
  expiringDate: Joi.date().greater("now").required().messages({
    "date.greater": "Expiring date must be in the future",
    "any.required": "Expiring date is required",
  }),
});
