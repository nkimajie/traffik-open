import * as Joi from "joi";
import { ProductGender } from "../enums/product-gender.enum";

const discountSchema = Joi.object({
  amount: Joi.number().min(0).max(1000000).required().messages({
    "number.min": "Discount amount cannot be negative",
    "number.max": "Discount amount cannot exceed 1,000,000",
  }),
  type: Joi.string().valid("fixed", "percentage").required().messages({
    "any.only": "Discount type must be fixed or percentage",
  }),
})
  .optional()
  .custom((value, helpers) => {
    if (
      value?.type === "percentage" &&
      typeof value.amount === "number" &&
      value.amount > 100
    ) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "Percentage discount cannot exceed 100",
  });

const expectedQuantitySchema = Joi.number()
  .integer()
  .min(0)
  .optional()
  .messages({
    "number.integer": "Expected quantity must be a whole number",
    "number.min": "Expected quantity cannot be negative",
  });

const variationSchema = Joi.object({
  /** An existing option being changed; omitted for a new option. */
  _id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({ "string.pattern.base": "Invalid option id" }),
  name: Joi.string().min(2).max(100).required().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name cannot exceed 100 characters",
    "any.required": "Name is required",
  }),
  attributes: Joi.object({
    color: Joi.string().optional(),
    colorCode: Joi.string()
      .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
      .when("color", {
        is: Joi.exist(),
        then: Joi.required().messages({
          "any.required":
            "colorCode is required when variation has a color attribute",
          "string.pattern.base":
            "colorCode must be a valid hex color starting with #",
        }),
        otherwise: Joi.optional(),
      }),
    image: Joi.string()
      .uri()
      .when("color", {
        is: Joi.exist(),
        then: Joi.required().messages({
          "any.required":
            "variation image is required when variation has a color attribute",
          "string.uri": "Variation image must be a valid URL",
        }),
        otherwise: Joi.optional(),
      }),
  })
    .pattern(Joi.string(), Joi.string())
    .min(1)
    .required()
    .messages({
      "object.min": "At least one attribute is required",
      "any.required": "Attributes are required",
    }),
  price: Joi.number().min(0).max(1000000).optional().messages({
    "number.min": "Price cannot be negative",
    "number.max": "Price cannot exceed 1,000,000",
  }),
  quantity: Joi.number().integer().min(0).max(1000000).required().messages({
    "number.integer": "Quantity must be a whole number",
    "number.min": "Quantity cannot be negative",
    "number.max": "Quantity cannot exceed 1,000,000",
    "any.required": "Quantity is required",
  }),
  expectedQuantity: expectedQuantitySchema,
  discount: discountSchema,
});

export const UpdateProductValidation = Joi.object({
  name: Joi.string().min(3).max(100).optional().messages({
    "string.min": "Product name must be at least 3 characters long",
    "string.max": "Product name cannot exceed 100 characters",
  }),
  description: Joi.string().max(2000).optional().messages({
    "string.max": "Description cannot exceed 2000 characters",
  }),
  amount: Joi.number().min(0).max(1000000).optional().messages({
    "number.min": "Amount cannot be negative",
    "number.max": "Amount cannot exceed 1,000,000",
  }),
  discount: discountSchema,
  categoryId: Joi.string().optional().messages({
    "string.base": "Category ID must be a string",
  }),
  subcategoryId: Joi.string().optional().allow(null, ""),
  /** Alias for clients sending camelCase; normalized to subcategoryId. */
  subCategoryId: Joi.string().optional().allow(null, ""),
  images: Joi.array()
    .items(Joi.string().uri().max(1000))
    .min(1)
    .optional()
    .messages({
      "array.min": "At least one image is required",
      "string.uri": "Each image must be a valid URL",
      "string.max": "Image URL cannot exceed 1000 characters",
    }),
  gender: Joi.string()
    .valid(...Object.values(ProductGender))
    .optional()
    .allow(null),
  quantity: Joi.number().integer().min(0).max(1000000).optional().messages({
    "number.integer": "Quantity must be a whole number",
    "number.min": "Quantity cannot be negative",
    "number.max": "Quantity cannot exceed 1,000,000",
  }),
  expectedQuantity: expectedQuantitySchema,
  variations: Joi.array().items(variationSchema).optional(),
  attributes: Joi.object()
    .pattern(Joi.string(), Joi.string())
    .max(40)
    .optional(),
})
  .custom((value, helpers) => {
    if (value && typeof value === "object") {
      const alt = value.subCategoryId;
      const primary = value.subcategoryId;
      if (
        alt !== undefined &&
        alt !== null &&
        alt !== "" &&
        primary !== undefined &&
        primary !== null &&
        primary !== "" &&
        String(alt) !== String(primary)
      ) {
        return helpers.error("custom.subcategoryIdConflict");
      }
      if (
        (primary === undefined || primary === null || primary === "") &&
        alt !== undefined &&
        alt !== null
      ) {
        value.subcategoryId = alt;
      }
      delete value.subCategoryId;
    }
    const vars = value?.variations;
    const attrs = value?.attributes;
    const hasAttrs =
      attrs != null &&
      typeof attrs === "object" &&
      !Array.isArray(attrs);
    if (hasAttrs && Array.isArray(vars) && vars.length > 0) {
      return helpers.error("custom.noAttributesWithVariations");
    }
    return value;
  })
  .messages({
    "custom.noAttributesWithVariations":
      "attributes cannot be used together with a non-empty variations array",
    "custom.subcategoryIdConflict":
      "subcategoryId and subCategoryId must match when both are sent",
  });
