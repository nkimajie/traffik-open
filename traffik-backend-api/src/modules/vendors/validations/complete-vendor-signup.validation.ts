import * as Joi from "joi";

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const businessHourSlotSchema = Joi.object({
  day: Joi.string()
    .valid(...WEEKDAYS)
    .required(),
  open: Joi.string().pattern(timePattern).required().messages({
    "string.pattern.base": "Open time must be in HH:MM format",
  }),
  close: Joi.string().pattern(timePattern).required().messages({
    "string.pattern.base": "Close time must be in HH:MM format",
  }),
});

export const CompleteVendorSignupValidation = Joi.object().keys({
  businessName: Joi.string().required().min(2).max(100),
  storeLogo: Joi.string().allow("").optional().uri().messages({
    "string.uri": "Please provide a valid logo URL",
  }),
  storeCoverPhoto: Joi.string().allow("").optional().uri().messages({
    "string.uri": "Please provide a valid cover photo URL",
  }),
  physicalStore: Joi.boolean().required(),
  physicalStoreAddress: Joi.string().when("physicalStore", {
    is: true,
    then: Joi.string().required().min(5).max(200),
    otherwise: Joi.string().optional().allow(""),
  }),
  businessEmail: Joi.string().email().required(),
  businessPhone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please provide a valid phone number",
    }),
  website: Joi.string().allow("").optional().uri().messages({
    "string.uri": "Please provide a valid URL",
  }),
  description: Joi.string().optional().max(500).allow(""),
  businessHours: Joi.array()
    .items(businessHourSlotSchema)
    .min(1)
    .max(7)
    .optional(),
  businessCategories: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .max(5)
    .required()
    .messages({
      "array.min": "Select at least one business category",
      "array.max": "Select at most five business categories",
    }),
  businessCategory: Joi.string().optional().max(100).allow(""),
});
