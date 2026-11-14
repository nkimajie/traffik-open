import * as Joi from "joi";
import { DeliveryMethod } from "../enums/order.enum";

export const CheckoutValidation = Joi.object({
  addressId: Joi.string()
    .trim()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .message("Invalid address ID format")
    .required(),
  deliveryMethod: Joi.string()
    .valid(...Object.values(DeliveryMethod))
    .required(),
});
