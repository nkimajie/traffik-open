export const AVAILABLE_INTERESTS = [
  "Clothing",
  "Shoes",
  "Accessories",
  "Electronics",
  "Beauty",
  "Home Decor",
  "Gadgets",
  "Groceries",
] as const;

export type UserInterest = (typeof AVAILABLE_INTERESTS)[number];
