import * as Joi from "joi";

export const UpdateProfileValidation = Joi.object().keys({
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  phone: Joi.alternatives()
    .try(
      Joi.object({
        number: Joi.string().required(),
        countryCode: Joi.string().required(),
      }),
      Joi.string().custom((value, helpers) => {
        try {
          const parsed = JSON.parse(value);
          if (!parsed.number || !parsed.countryCode) {
            return helpers.error("any.invalid");
          }
          return parsed;
        } catch {
          return helpers.error("any.invalid");
        }
      }),
    )
    .optional(),
  profilePicture: Joi.any().optional(),
});
