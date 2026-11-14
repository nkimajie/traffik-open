import * as Joi from "joi";

const imageUrl = Joi.string().trim().max(2048);

export const CreateProductReviewValidation = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(2000).allow("").default(""),
  images: Joi.array().items(imageUrl).max(8).default([]),
  orderId: Joi.string()
    .trim()
    .optional()
    .allow(null, "")
    .custom((value, helpers) => {
      if (value == null || value === "") {
        return undefined;
      }
      if (!/^[a-fA-F0-9]{24}$/.test(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    })
    .messages({ "any.invalid": "orderId must be a valid id" }),
});

export const UpdateProductReviewValidation = Joi.object({
  rating: Joi.number().integer().min(1).max(5).optional(),
  comment: Joi.string().trim().max(2000).allow("").optional(),
  images: Joi.array().items(imageUrl).max(8).optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided to update",
  });
