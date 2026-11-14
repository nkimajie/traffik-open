/**
 * An unpaid order older than this is "stale": it is checked with Kashia and
 * its stock released if the payment never happened, by the regular sweep of
 * abandoned checkouts or when a checkout runs short of that stock.
 */
export const PENDING_PAYMENT_HOLD_MS = 30 * 60 * 1000;

/**
 * Upper bound on how long an unpaid order may hold stock, even while its
 * Kashia payment link still reports as open.
 */
export const PENDING_PAYMENT_MAX_HOLD_MS = 24 * 60 * 60 * 1000;

/** Stale unpaid orders examined per reclaim pass, to bound checkout latency. */
export const STALE_HOLD_RECLAIM_LIMIT = 20;

/**
 * How long after checking an unpaid order with Kashia (its payment link was
 * still open) before checking it again. Keeps sweeps from asking Kashia about
 * the same open links every run, and lets every stale hold get its turn.
 */
export const STALE_HOLD_RECHECK_MS = 5 * 60 * 1000;

/**
 * Longest a sweep of abandoned checkouts keeps going. Comfortably inside the
 * scheduled function's timeout, so a run ends cleanly; the next run carries
 * on where it stopped.
 */
export const STALE_HOLD_SWEEP_BUDGET_MS = 90 * 1000;

/**
 * Longest a checkout spends freeing stale holds when it runs short, since a
 * shopper is waiting (and the checkout must finish well inside its lock and
 * the Lambda timeout). The sweep of abandoned checkouts checks the rest.
 */
export const CHECKOUT_RECLAIM_BUDGET_MS = 8 * 1000;
