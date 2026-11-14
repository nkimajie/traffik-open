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

/**
 * Store hours are local trading hours. The API runs in UTC, so evaluating them
 * against the server clock would close Nigerian stores an hour early.
 */
const STORE_TIME_ZONE = "Africa/Lagos";

function parseTime(value: string): number | null {
  const match = value
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const meridiem = match[3];

  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

export function normalizeBusinessHours(
  businessHours: unknown,
): BusinessHourSlot[] | null {
  if (!Array.isArray(businessHours)) return null;

  const slots = businessHours.filter(
    (slot): slot is BusinessHourSlot =>
      !!slot &&
      typeof slot === "object" &&
      "day" in slot &&
      "open" in slot &&
      "close" in slot,
  );
  return slots.length ? slots : null;
}

/** Weekday index and minutes-since-midnight in the store's timezone. */
function nowInStoreTimeZone(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const lookup = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const day = DAY_MAP[lookup("weekday").toLowerCase()] ?? now.getUTCDay();
  const hour = Number(lookup("hour")) % 24;
  const minute = Number(lookup("minute"));

  return { day, minutes: hour * 60 + minute };
}

/**
 * Whether a store is currently trading. Stores that never configured hours are
 * treated as always open, so the check never blocks an existing store.
 */
export function isStoreOpen(businessHours: unknown, now = new Date()): boolean {
  const slots = normalizeBusinessHours(businessHours);
  if (!slots?.length) return true;

  const { day, minutes } = nowInStoreTimeZone(now);

  const todaySlots = slots.filter(
    (slot) => DAY_MAP[slot.day?.trim().toLowerCase()] === day,
  );
  if (!todaySlots.length) return false;

  return todaySlots.some((slot) => {
    const open = parseTime(slot.open);
    const close = parseTime(slot.close);
    if (open === null || close === null) return false;
    // A close time at or before open means the slot runs past midnight.
    if (close <= open) return minutes >= open || minutes < close;
    return minutes >= open && minutes < close;
  });
}
