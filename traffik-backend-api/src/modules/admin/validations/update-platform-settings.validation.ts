import * as Joi from "joi";

export const UpdatePlatformSettingsValidation = Joi.object({
  commissionPercentage: Joi.number().min(0).max(20).required(),
});
