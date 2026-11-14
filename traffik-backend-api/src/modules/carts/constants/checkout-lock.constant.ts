/**
 * How long a checkout holds the per-shopper lock. Comfortably above the time a
 * checkout takes (the Lambda timeout is 30s), so a crashed request cannot
 * block the shopper for long.
 */
export const CHECKOUT_LOCK_TTL_MS = 30 * 1000;
