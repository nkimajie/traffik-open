import * as Joi from "joi";

export const AddCartItemValidation = Joi.object({
  productId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .message("Invalid product ID format")
    .required(),
  variationId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .message("Invalid variation ID format")
    .optional(),
  quantity: Joi.number().integer().min(1).required().messages({
    "number.min": "Quantity must be at least 1",
  }),
});

export const SaveCartItemForLaterValidation = Joi.object({
  productId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .message("Invalid product ID format")
    .required(),
});

export const UpdateCartItemValidation = Joi.object({
  quantity: Joi.number().integer().min(1).required().messages({
    "number.min": "Quantity must be at least 1",
  }),
});

export const ApplyVoucherValidation = Joi.object({
  code: Joi.string().trim().required(),
});
