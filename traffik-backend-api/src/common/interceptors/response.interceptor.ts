import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { ApiResponse } from "../interfaces/response.interface";

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const status = response.statusCode;

        // If data is already in ApiResponse format, return it
        if (data && typeof data === "object" && "status" in data) {
          return data as ApiResponse<T>;
        }

        // Transform the response into ApiResponse format
        return {
          status,
          message: this.getStatusMessage(status),
          data,
        };
      }),
    );
  }

  private getStatusMessage(status: number): string {
    const messages: { [key: number]: string } = {
      200: "Success",
      201: "Created successfully",
      202: "Accepted",
      204: "No content",
      400: "Bad request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not found",
      500: "Internal server error",
    };

    return messages[status] || "Success";
  }
}
