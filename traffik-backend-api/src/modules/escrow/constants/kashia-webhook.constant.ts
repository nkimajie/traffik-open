/**
 * A delivery still marked `processing` after this long is treated as abandoned
 * (for example the Lambda was frozen or killed mid-way) and a redelivery of it
 * is processed again. Comfortably above the 30s function timeout.
 */
export const KASHIA_WEBHOOK_PROCESSING_STALE_MS = 5 * 60 * 1000;

/** Upper bound on the error text kept on a failed webhook record. */
export const KASHIA_WEBHOOK_ERROR_MAX_LENGTH = 500;

/**
 * Told to Kashia (Retry-After, seconds) when a delivery arrives while an
 * earlier delivery of the same event is still being processed.
 */
export const KASHIA_WEBHOOK_IN_PROGRESS_RETRY_AFTER_S = 30;

/**
 * Failed deliveries are replayed from their stored payload by a scheduled
 * job, waiting this long times the attempts so far before each retry.
 */
export const KASHIA_WEBHOOK_REPLAY_BACKOFF_MS = 5 * 60 * 1000;

/**
 * Attempts after which a failing delivery is no longer replayed
 * automatically (its record stays `failed` for someone to look at). With the
 * backoff above, the last automatic attempt is about three hours after the
 * first.
 */
export const KASHIA_WEBHOOK_REPLAY_MAX_ATTEMPTS = 8;

/** Deliveries replayed per run, and how long a run may take. */
export const KASHIA_WEBHOOK_REPLAY_BATCH = 25;
export const KASHIA_WEBHOOK_REPLAY_BUDGET_MS = 90 * 1000;
