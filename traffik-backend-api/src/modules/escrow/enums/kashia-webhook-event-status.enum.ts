/** Lifecycle of a received Kashia webhook delivery. */
export enum KashiaWebhookEventStatus {
  /** Claimed by a worker; handling is under way. */
  PROCESSING = "processing",
  /** Handled to completion. Further deliveries are duplicates. */
  PROCESSED = "processed",
  /** Handling threw. The next delivery of the same webhook_id is retried. */
  FAILED = "failed",
}
