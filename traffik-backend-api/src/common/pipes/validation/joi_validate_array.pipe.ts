/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from "@nestjs/common";
import { ArraySchema } from "joi";

@Injectable()
export class JoiArrayValidationPipe {
  constructor(private schema: ArraySchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
    const { error } = this.schema.validate(value);
    if (error) {
      throw new BadRequestException(this.modifyErrors(error));
    }

    return value;
  }

  modifyErrors(errors) {
    return !errors?.details
      ? (errors?.message ?? "An error occured in body validation.")
      : errors?.details[0]?.message;
  }
}
