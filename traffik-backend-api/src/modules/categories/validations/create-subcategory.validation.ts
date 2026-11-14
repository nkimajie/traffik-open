import * as Joi from "joi";

export const CreateSubcategoryValidation = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    "string.min": "Subcategory name must be at least 2 characters long",
    "string.max": "Subcategory name cannot exceed 50 characters",
    "any.required": "Subcategory name is required",
  }),
  categoryId: Joi.string().required().messages({
    "any.required": "Category ID is required",
    "string.base": "Category ID must be a string",
  }),
  description: Joi.string().max(500).optional().allow(null, ""),
});
