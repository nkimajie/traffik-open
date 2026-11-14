import { OperationFeedback } from "../interfaces/operation_feedback.interface";
import { Pagination } from "../interfaces/pagination.interface";

export type PromisifiedPaginatedOperationFeedback<T> = Promise<
  OperationFeedback<Pagination<T>>
>;
