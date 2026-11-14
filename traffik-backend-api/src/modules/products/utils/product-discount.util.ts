import { ProductDiscountType } from "../enums/product-discount-type.enum";
import { IProductDiscount } from "../interfaces/product.interface";
import { roundRating } from "src/common/utils/number.util";

export function isActiveProductDiscount(
  d?: IProductDiscount | null,
): d is IProductDiscount {
  if (!d || d.amount == null) return false;
  const amt = Number(d.amount);
  if (!Number.isFinite(amt) || amt <= 0) return false;
  if (
    d.type !== ProductDiscountType.FIXED &&
    d.type !== ProductDiscountType.PERCENTAGE
  ) {
    return false;
  }
  if (d.type === ProductDiscountType.PERCENTAGE && amt > 100) {
    return false;
  }
  return true;
}

/** Snapshot safe to persist on cart/order lines. */
export function cloneProductDiscount(d: IProductDiscount): IProductDiscount {
  return {
    amount: Number(d.amount),
    type: d.type,
  };
}

/**
 * Applies fixed (currency off) or percentage discount to a list/base unit price.
 */
export function applyProductDiscount(
  base: number,
  discount?: IProductDiscount | null,
): number {
  if (!isActiveProductDiscount(discount)) {
    return base;
  }
  const amt = Number(discount.amount);
  let next: number;
  if (discount.type === ProductDiscountType.PERCENTAGE) {
    next = base * (1 - amt / 100);
  } else {
    next = base - amt;
  }
  if (next < 0) next = 0;
  return Math.round(next * 100) / 100;
}

export function discountsEqual(
  a?: IProductDiscount | null,
  b?: IProductDiscount | null,
): boolean {
  if (!isActiveProductDiscount(a) && !isActiveProductDiscount(b)) return true;
  if (!isActiveProductDiscount(a) || !isActiveProductDiscount(b)) return false;
  return a.amount === b.amount && a.type === b.type;
}

export function enrichProductWithFinalPrice(product: any): any {
  if (!product) return product;

  // Convert Mongoose document to plain object if needed
  const isDocument = typeof product.toObject === "function";
  const enriched = isDocument ? product.toObject() : { ...product };

  const hasSystemDiscount = isActiveProductDiscount(enriched.discount);

  // Compute product-level final price
  if (hasSystemDiscount && typeof enriched.amount === "number") {
    enriched.discount.finalPrice = applyProductDiscount(
      enriched.amount,
      enriched.discount,
    );
  } else {
    enriched.discount = null;
  }

  // Compute variation-level final prices relying strictly on the product-level discount
  if (Array.isArray(enriched.variations)) {
    enriched.variations.forEach((variation: any) => {
      if (hasSystemDiscount) {
        const basePrice =
          typeof variation.price === "number"
            ? variation.price
            : enriched.amount;

        variation.discount = cloneProductDiscount(enriched.discount);
        variation.discount.finalPrice = applyProductDiscount(
          basePrice,
          variation.discount,
        );
      } else {
        variation.discount = null;
      }
    });
  }

  // Compute defaultVariation final price
  if (enriched.defaultVariation) {
    if (hasSystemDiscount) {
      const basePrice =
        typeof enriched.defaultVariation.price === "number"
          ? enriched.defaultVariation.price
          : enriched.amount;

      enriched.defaultVariation.discount = cloneProductDiscount(
        enriched.discount,
      );
      enriched.defaultVariation.discount.finalPrice = applyProductDiscount(
        basePrice,
        enriched.defaultVariation.discount,
      );
    } else {
      enriched.defaultVariation.discount = null;
    }
  }

  return enriched;
}
