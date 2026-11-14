import * as Joi from "joi";
import { AVAILABLE_INTERESTS } from "../constants/interests.constant";

export const UpdateInterestsValidation = Joi.object().keys({
  interests: Joi.array()
    .items(Joi.string().valid(...AVAILABLE_INTERESTS))
    .min(1)
    .required()
    .messages({
      "array.min": "At least one interest must be selected",
      "any.only":
        "Invalid interest. Must be one of: " + AVAILABLE_INTERESTS.join(", "),
    }),
});
