import { OperationFeedback } from "../interfaces/operation_feedback.interface";

export class BaseService {
  constructor() {}

  protected Result<T>(
    failed: boolean,
    description?: string,
    data?: T,
    code?: number,
  ): OperationFeedback<T> {
    const feedback = new OperationFeedback(
      failed,
      data,
      description
        ? description
        : failed
          ? "Operation failed"
          : "Operation successful",
      code,
    );
    return feedback;
  }
}
