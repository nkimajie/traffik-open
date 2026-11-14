import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  normalizeStructuredPhone,
  PhoneParts,
} from "./ng-phone.util";

const NG_DIAL = "+234";

export type StructuredPhoneValidation =
  | { ok: true; normalized: PhoneParts; countryISOCode: string }
  | { ok: false; message: string; code: "INVALID_PHONE" };

/**
 * Validates country calling code + national number with libphonenumber-js.
 * Rejects unknown/invalid dial codes (e.g. +818) and malformed numbers.
 * Returns normalized parts and ISO country code on success.
 */
export function validateStructuredPhone(
  phone: PhoneParts,
): StructuredPhoneValidation {
  if (!phone?.countryCode?.trim() || !phone?.number?.trim()) {
    return {
      ok: false,
      message: "Phone country code and number are required.",
      code: "INVALID_PHONE",
    };
  }

  const normalized = normalizeStructuredPhone(phone);

  if (normalized.countryCode === NG_DIAL) {
    const nationalDigits = normalized.number.replace(/\D/g, "");
    const e164 = `${NG_DIAL}${nationalDigits}`;
    const parsed = parsePhoneNumberFromString(e164);
    if (!parsed?.isValid()) {
      return {
        ok: false,
        message: "Invalid Nigerian phone number.",
        code: "INVALID_PHONE",
      };
    }
    return {
      ok: true,
      normalized: {
        countryCode: NG_DIAL,
        number: nationalDigits,
      },
      countryISOCode: "NG",
    };
  }

  const dial = normalized.countryCode.replace(/\D/g, "");
  const national = normalized.number.replace(/\D/g, "");
  if (!dial || !national) {
    return {
      ok: false,
      message: "Invalid phone number or country calling code.",
      code: "INVALID_PHONE",
    };
  }

  const e164 = `+${dial}${national}`;
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed?.isValid()) {
    return {
      ok: false,
      message:
        "Invalid country calling code or phone number. Use a valid dial code (e.g. +234 for Nigeria, +81 for Japan).",
      code: "INVALID_PHONE",
    };
  }

  const iso = parsed.country;
  if (!iso) {
    return {
      ok: false,
      message: "Could not determine country from this phone number.",
      code: "INVALID_PHONE",
    };
  }

  return {
    ok: true,
    normalized: {
      countryCode: `+${parsed.countryCallingCode}`,
      number: String(parsed.nationalNumber),
    },
    countryISOCode: iso,
  };
}

/**
 * @deprecated Prefer validateStructuredPhone for writes; kept for soft lookups.
 */
export function deriveIso3166FromPhone(phone: {
  number?: string;
  countryCode?: string;
}): string | undefined {
  if (!phone?.number?.trim() || !phone?.countryCode?.trim()) {
    return undefined;
  }
  const v = validateStructuredPhone(phone as PhoneParts);
  return v.ok ? v.countryISOCode : undefined;
}
