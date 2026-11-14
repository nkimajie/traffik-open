import * as Joi from "joi";

export const CreateWaitlistValidation = Joi.object().keys({
  email: Joi.string().email().required(),
  phone: Joi.object({
    countryCode: Joi.string()
      .pattern(/^\+?[1-9]\d{1,3}$/)
      .required()
      .messages({
        "string.pattern.base": "Invalid country code format",
      }),
    number: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .required()
      .messages({
        "string.pattern.base": "Invalid phone number format",
      }),
  }).required(),
});
