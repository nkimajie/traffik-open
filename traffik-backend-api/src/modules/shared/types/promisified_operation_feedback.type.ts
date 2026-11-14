import { OperationFeedback } from "../interfaces/operation_feedback.interface";

export type PromisifiedOperationFeedback<T> = Promise<OperationFeedback<T>>;
