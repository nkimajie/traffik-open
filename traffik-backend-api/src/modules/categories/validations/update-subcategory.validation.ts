import * as Joi from "joi";

export const UpdateSubcategoryValidation = Joi.object({
  name: Joi.string().min(2).max(50).optional().messages({
    "string.min": "Subcategory name must be at least 2 characters long",
    "string.max": "Subcategory name cannot exceed 50 characters",
  }),
  categoryId: Joi.string().optional().messages({
    "string.base": "Category ID must be a string",
  }),
  description: Joi.string().max(500).optional().allow(null, ""),
}).min(1);
