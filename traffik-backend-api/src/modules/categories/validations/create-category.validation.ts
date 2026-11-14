import * as Joi from "joi";

export const CreateCategoryValidation = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    "string.min": "Category name must be at least 2 characters long",
    "string.max": "Category name cannot exceed 50 characters",
    "any.required": "Category name is required",
  }),
  description: Joi.string().max(500).optional().messages({
    "string.max": "Description cannot exceed 500 characters",
  }),
});
