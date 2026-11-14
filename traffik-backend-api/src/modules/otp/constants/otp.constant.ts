/** Length of the emailed verification code; the apps render this many inputs. */
export const OTP_DIGITS = 4;

/** TOTP time step, in seconds (1 hour). */
export const OTP_STEP_SECONDS = 60 * 60;

/**
 * Steps accepted either side of now, as [past, future]. Expiry is enforced by
 * `expiresAt`; the window only has to cover a code issued late in one step and
 * entered early in the next. A wider window made many codes valid at once,
 * which eased guessing.
 */
export const OTP_VERIFY_WINDOW: [number, number] = [1, 0];

/** How long a code stays valid after it is issued (1 hour). */
export const OTP_TTL_MS = 60 * 60 * 1000;

/** Wrong guesses allowed per code before a new one must be requested. */
export const OTP_MAX_ATTEMPTS = 5;

/** Minimum gap between codes for one account; mirrors the UI resend timer. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_RESEND_COOLDOWN_MS = OTP_RESEND_COOLDOWN_SECONDS * 1000;
