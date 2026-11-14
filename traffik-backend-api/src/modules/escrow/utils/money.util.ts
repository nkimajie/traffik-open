/** Converts a naira amount (Traffik's internal unit) to integer kobo for Kashia. */
export function nairaToKobo(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}

/** Converts integer kobo from Kashia back to naira for display or storage. */
export function koboToNaira(kobo: number): number {
  return Math.round((kobo / 100 + Number.EPSILON) * 100) / 100;
}
