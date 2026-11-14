/** Round a product average rating to one decimal place for API responses. */
export function roundRating(rating: number): number {
  if (!Number.isFinite(rating) || rating <= 0) return 0;
  return Math.round(rating * 10) / 10;
}
