/** What happened to one webhook delivery, for logs and the audit record. */
export interface KashiaWebhookProcessResult {
  /**
   * `processed`: handled on this delivery. `duplicate`: handled by an earlier
   * one. `in_progress`: an earlier delivery is still being handled, so this
   * one must not be acknowledged (it may yet fail).
   */
  disposition: "processed" | "duplicate" | "in_progress";
  /** Short handler result, e.g. "order confirmed". */
  outcome?: string;
  /** Processing attempt number; >1 means a retry of a failed delivery. */
  attempt?: number;
}

/** What one replay run of failed or abandoned deliveries did. */
export interface KashiaWebhookReplayResult {
  /** Deliveries picked up for another attempt. */
  attempted: number;
  /** Of those, handled successfully this time. */
  recovered: number;
  /** Of those, failed again (and will be retried later, unless given up). */
  failed: number;
  /** Failed for the last time: no more automatic retries. */
  gaveUp: number;
}
