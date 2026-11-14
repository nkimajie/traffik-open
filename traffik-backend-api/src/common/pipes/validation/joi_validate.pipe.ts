/* eslint-disable @typescript-eslint/no-unused-vars */
import { PipeTransform, Injectable, ArgumentMetadata } from "@nestjs/common";
import { ObjectSchema } from "joi";
import { ErrorResponse } from "../../../modules/shared/dtos/response.error.dto";

@Injectable()
export class JoiValidationPipe {
  constructor(private schema: ObjectSchema) {}

  /**
   * @description
   * Transforms the incoming request value by validating it against the defined Joi schema.
   * If validation fails, throws a BadRequestException with a modified error message.
   *
   * @param {any} value - The value to be transformed and validated.
   * @param {ArgumentMetadata} metadata - Additional metadata about the request.
   * @returns {any} The validated value if no validation errors occur.
   * @throws {BadRequestException} If validation fails.
   */
  transform(value: any, metadata: ArgumentMetadata) {
    const { error, value: validatedValue } = this.schema.validate(value);
    if (error) {
      throw new ErrorResponse(this.modifyErrors(error), 400, false);
    }

    return validatedValue;
  }

  /**
   * @description
   * Modify Joi validation errors to be more machine readable.
   *
   * @param {ValidationError} errors - Joi validation errors
   * @returns {object} Modified errors
   */
  modifyErrors(errors) {
    if (!errors.details || errors.details.length === 0) {
      return errors.message;
    }

    // Extract just the first validation error string cleanly without quotes
    // to match standard service result error strings
    return errors.details[0].message.replace(/"/g, "");
  }
}
