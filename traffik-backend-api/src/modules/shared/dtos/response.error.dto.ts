import { HttpException } from "@nestjs/common";

/**
 * @description this class describes an error
 */
export class ResponseDescription {
  constructor(
    public message: string,
    public code: number,
  ) {}
}

/**
 * @description describes error response and holds all error response description and codes
 */
export class ErrorResponse extends HttpException {
  static UNAUTHORIZED_ROUTE_ACCESS = new ResponseDescription(
    "unauthorized route access",
    401,
  );

  constructor(
    public message: string = "An error has occurred",
    public statusCode = 400,
    public success = false,
    meta?: string,
    /**
     * Machine-readable payload for failures the client must branch on rather than
     * just display, such as a cart store conflict that drives a resolution dialog.
     */
    data?: unknown,
  ) {
    super(
      {
        message,
        success,
        statusCode,
        meta,
        ...(data !== undefined && { data }),
      },
      statusCode,
    );
  }
}
