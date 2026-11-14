/**
 * Nigerian (+234) phone normalization helpers.
 * Foreign numbers (E.164 not starting with +234) are passed through unchanged where noted.
 */

const NG_E164_PREFIX = "+234";

function cleanedDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function isForeignE164(phone: string): boolean {
  return phone.trim().startsWith("+") && !phone.trim().startsWith(NG_E164_PREFIX);
}

/**
 * Nigerian national mobile significant number: 10 digits, no trunk "0".
 */
export function stripNigerianTrunkZero(nationalDigits: string): string {
  const d = nationalDigits.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) {
    return d.slice(1);
  }
  return d;
}

/**
 * Normalizes Nigerian mobiles to E.164 (+234…). Leaves other international numbers as-is.
 * Handles "+234" + "0905…" (user included trunk 0 after country code) → +234905…
 */
export function formatNigerianToE164(phoneNumber: string): string {
  const cleaned = cleanedDigits(phoneNumber);
  if (isForeignE164(phoneNumber)) {
    return phoneNumber.trim();
  }

  // 234 + mistaken trunk 0 + 10-digit mobile → 14 digits (e.g. 23409051458074)
  if (
    cleaned.startsWith("234") &&
    cleaned.length === 14 &&
    cleaned[3] === "0"
  ) {
    return `${NG_E164_PREFIX}${cleaned.slice(4)}`;
  }

  // 234 + 10-digit national (13 digits total)
  if (cleaned.startsWith("234") && cleaned.length === 13) {
    return `${NG_E164_PREFIX}${cleaned.slice(3)}`;
  }

  if (cleaned.startsWith("0") && cleaned.length === 11) {
    return `${NG_E164_PREFIX}${cleaned.slice(1)}`;
  }

  if (cleaned.length === 10) {
    return `${NG_E164_PREFIX}${cleaned}`;
  }

  return phoneNumber.trim();
}

/**
 * Converts +234 / 234 to 0-prefixed local; normalizes 0/10-digit Nigerian to E.164;
 * leaves foreign +… unchanged.
 */
export function formatNigerianBidirectional(phoneNumber: string): string {
  const cleaned = cleanedDigits(phoneNumber);
  const trimmed = phoneNumber.trim();

  if (isForeignE164(phoneNumber)) {
    return trimmed;
  }

  if (
    cleaned.startsWith("234") &&
    cleaned.length === 14 &&
    cleaned[3] === "0"
  ) {
    return `0${cleaned.slice(4)}`;
  }

  if (trimmed.startsWith(NG_E164_PREFIX) && cleaned.length === 13) {
    return `0${cleaned.slice(3)}`;
  }

  if (trimmed.startsWith("234") && cleaned.length === 13) {
    return `0${cleaned.slice(3)}`;
  }

  if (cleaned.startsWith("0") && cleaned.length === 11) {
    return `${NG_E164_PREFIX}${cleaned.slice(1)}`;
  }

  if (cleaned.length === 10) {
    return `${NG_E164_PREFIX}${cleaned}`;
  }

  return trimmed;
}


export interface PhoneParts {
  countryCode: string;
  number: string;
}

/** Normalizes Nigerian { countryCode, number } to +234 + 10-digit national (no leading 0). */
export function normalizeStructuredPhone(phone: PhoneParts): PhoneParts {
  const cc = phone.countryCode.trim().replace(/\s/g, "");
  let national = phone.number.replace(/\s/g, "");

  const dialDigits = cc.replace(/\D/g, "");
  const isNigeria =
    cc.startsWith(NG_E164_PREFIX) || dialDigits === "234";

  if (isNigeria) {
    national = stripNigerianTrunkZero(national);
    const nationalDigits = national.replace(/\D/g, "");
    const combined = `${NG_E164_PREFIX}${nationalDigits}`;
    const e164 = formatNigerianToE164(combined);
    if (e164.startsWith(NG_E164_PREFIX)) {
      return { countryCode: NG_E164_PREFIX, number: e164.slice(4) };
    }
  }

  const combined = `${cc}${national}`.replace(/\s/g, "");
  const e164 = formatNigerianToE164(combined);
  if (e164.startsWith(NG_E164_PREFIX)) {
    return { countryCode: NG_E164_PREFIX, number: e164.slice(4) };
  }

  return {
    countryCode: phone.countryCode.trim(),
    number: national,
  };
}
