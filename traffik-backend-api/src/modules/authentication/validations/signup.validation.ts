import * as Joi from "joi";
import { UserRole } from "src/modules/users/enums/user-role.enum";

export const SignupValidation = Joi.object().keys({
  firstName: Joi.string().required().min(2).max(50),
  lastName: Joi.string().required().min(2).max(50),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(8).max(50),
  role: Joi.string().valid(...Object.values(UserRole)),
  phone: Joi.object({
    number: Joi.string().required(),
    countryCode: Joi.string().required(),
  }).required(),
});
