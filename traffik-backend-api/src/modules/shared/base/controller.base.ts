import { HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { SuccessResponse } from "../dtos/response.success.dto";
import { BaseExceptionHandler } from "./exception_handler.base";

export class BaseController extends BaseExceptionHandler {
  constructor() {
    super();
  }

  /**
   * @description return success response
   */
  protected successResponse<T>(
    res: Response,
    message: string,
    data?: T,
    status?: HttpStatus,
  ) {
    return res
      .status(status || HttpStatus.OK)
      .json(new SuccessResponse(message, data, status || HttpStatus.OK));
  }
}
