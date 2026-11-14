export type BusinessHourSlot = {
  day: string;
  open: string;
  close: string;
};

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function parseTime(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const meridiem = match[3];

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/** API may return structured slots or a free-text string from vendor onboarding. */
export function normalizeBusinessHours(
  businessHours: unknown,
): BusinessHourSlot[] | null {
  if (!businessHours) return null;

  if (Array.isArray(businessHours)) {
    const slots = businessHours
      .filter(
        (slot): slot is BusinessHourSlot =>
          !!slot &&
          typeof slot === "object" &&
          typeof (slot as BusinessHourSlot).day === "string" &&
          (slot as BusinessHourSlot).day.trim().length > 0 &&
          typeof (slot as BusinessHourSlot).open === "string" &&
          typeof (slot as BusinessHourSlot).close === "string",
      )
      .map((slot) => ({
        day: slot.day.trim().toLowerCase(),
        open: slot.open.trim(),
        close: slot.close.trim(),
      }));
    return slots.length ? slots : null;
  }

  return null;
}

export function hasStructuredBusinessHours(businessHours: unknown): boolean {
  return normalizeBusinessHours(businessHours) !== null;
}

export function isStoreOpen(
  businessHours: unknown,
  now = new Date(),
): boolean {
  const slots = normalizeBusinessHours(businessHours);
  if (!slots?.length) return true;

  const today = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todaySlots = slots.filter((slot) => {
    const dayKey = slot.day?.trim().toLowerCase();
    return dayKey && DAY_MAP[dayKey] === today;
  });

  if (!todaySlots.length) return false;

  return todaySlots.some((slot) => {
    const open = parseTime(slot.open);
    const close = parseTime(slot.close);
    if (open === null || close === null) return false;
    if (close <= open) return currentMinutes >= open || currentMinutes < close;
    return currentMinutes >= open && currentMinutes < close;
  });
}
