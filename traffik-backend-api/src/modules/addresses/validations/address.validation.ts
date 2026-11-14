import * as Joi from "joi";

export const CreateAddressValidation = Joi.object({
  fullName: Joi.string().trim().required(),
  state: Joi.string().trim().required(),
  city: Joi.string().trim().required(),
  streetAddress: Joi.string().trim().required(),
  landmark: Joi.string().trim().optional().allow(""),
  zipCode: Joi.string().trim().required(),
  phone: Joi.string().trim().required(),
  isDefault: Joi.boolean().optional().default(false),
});

export const UpdateAddressValidation = Joi.object({
  fullName: Joi.string().trim().optional(),
  state: Joi.string().trim().optional(),
  city: Joi.string().trim().optional(),
  streetAddress: Joi.string().trim().optional(),
  landmark: Joi.string().trim().optional().allow(""),
  zipCode: Joi.string().trim().optional(),
  phone: Joi.string().trim().optional(),
  isDefault: Joi.boolean().optional(),
}).min(1);
