/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
import { ReturnPayload } from "./return_payload";

/**
 * @description describe service action response [Use this instead of the ReturnPayload]
 */
export interface OperationFeedback<T> extends ReturnPayload<T> {}

export class OperationFeedback<T> extends ReturnPayload<T> {
  constructor(
    public failed = false,
    public data?: T,
    public description?: string,
    public code?: number,
  ) {
    super(failed, data, description);
  }
}
