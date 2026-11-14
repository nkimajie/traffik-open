import * as Joi from "joi";
import { OrderStatus } from "../enums/order.enum";

export const UpdateOrderStatusValidation = Joi.object({
  status: Joi.string()
    .valid(...Object.values(OrderStatus))
    .required(),
  description: Joi.string().trim().required(),
});
