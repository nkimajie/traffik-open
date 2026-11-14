import { HttpStatus } from "@nestjs/common";
import { ResponseDescription, ErrorResponse } from "../dtos/response.error.dto";

export class BaseExceptionHandler {
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
  protected throwErrorRaw(
    description: string,
    code?: number,
    addMeta = false,
    meta?: string,
  ) {
    if (typeof code != "number") {
      code = HttpStatus.BAD_REQUEST;
    }

    throw new ErrorResponse(
      description,
      code || HttpStatus.BAD_REQUEST,
      false,
      addMeta ? meta || description : undefined,
    );
  }

  /**
   * @description throw an error that carries a machine-readable payload, for
   * failures the client resolves interactively instead of merely displaying.
   */
  protected throwErrorWithData(
    description: string,
    code: number | undefined,
    data: unknown,
  ) {
    throw new ErrorResponse(
      description,
      typeof code === "number" ? code : HttpStatus.BAD_REQUEST,
      false,
      undefined,
      data,
    );
  }
}
