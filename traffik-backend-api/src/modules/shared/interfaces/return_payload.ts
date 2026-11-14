/**
 * @description used by all methods to return results [User OperationFeedback instead of this class]
 */
export class ReturnPayload<T> {
  constructor(
    public failed = false,
    public data?: T,
    public description?: string,
  ) {}
}
