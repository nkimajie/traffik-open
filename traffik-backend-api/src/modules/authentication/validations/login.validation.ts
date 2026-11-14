import * as Joi from "joi";
import { UserRole } from "src/modules/users/enums/user-role.enum";

export const LoginValidation = Joi.object().keys({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  notificationToken: Joi.string().default(null).allow(null),
  deviceId: Joi.string().required(),
  role: Joi.string()
    .valid(...Object.values(UserRole))
    .required(),
});

export const AdminLoginValidation = Joi.object().keys({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
