import * as Joi from "joi";

const NotificationChannelsSchema = Joi.object().keys({
  email: Joi.boolean().optional(),
  push: Joi.boolean().optional(),
  sms: Joi.boolean().optional(),
});

export const UpdateNotificationSettingsValidation = Joi.object().keys({
  general: Joi.boolean().optional(),
  updates: NotificationChannelsSchema.optional(),
  promotions: NotificationChannelsSchema.optional(),
});
