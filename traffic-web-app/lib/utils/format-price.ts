export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function discountPercent(amount: number, finalPrice: number): number {
  if (amount <= 0 || finalPrice >= amount) return 0;
  return Math.round(((amount - finalPrice) / amount) * 100);
}
