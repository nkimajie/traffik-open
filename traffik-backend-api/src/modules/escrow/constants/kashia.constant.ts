/**
 * Longest a call to the Kashia API may take. Checkouts make a few calls in
 * a row and must finish inside the 30s checkout lock and Lambda timeout.
 */
export const KASHIA_REQUEST_TIMEOUT_MS = 8 * 1000;
