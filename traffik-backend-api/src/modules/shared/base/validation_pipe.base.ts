import { HttpStatus } from "@nestjs/common";
import { ResponseDescription, ErrorResponse } from "../dtos/response.error.dto";

export class BaseValidationPipe {
  /**
   * @description throw error
   * @param response
   */
  protected throwError(response: ResponseDescription, meta?: string) {
    throw new ErrorResponse(response.message, response.code, false, meta);
  }

  /**
   * @description throw error
   * @param response
   */
  protected throwErrorRaw(description: string, code?: number, addMeta = false) {
    throw new ErrorResponse(
      description,
      code || HttpStatus.BAD_REQUEST,
      false,
      addMeta ? description : undefined,
    );
  }
}
