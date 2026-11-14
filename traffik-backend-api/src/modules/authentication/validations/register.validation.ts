import * as Joi from "joi";

export const registerValidation = Joi.object().keys({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  userType: Joi.string().default("USER").allow("USER"),
  password: Joi.string()
    .min(8)
    // .pattern(
    //   new RegExp(
    //     '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#\\$%^&*()_+>\\\\<\\?£-])[\\w!@#\\$%^&*()_+>\\\\<\\?£-]{8,}$',
    //   ),
    // )
    .messages({
      "string.pattern.base":
        "Password strength weak. please include symbol(s) and number(s)",
    })
    .required(),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "password do not match",
  }),
  notificationToken: Joi.string().default(null),
  deviceId: Joi.string().required(),
  phone: Joi.object({
    number: Joi.string().required(),
    countryCode: Joi.string().required(),
  }).required(),
});
