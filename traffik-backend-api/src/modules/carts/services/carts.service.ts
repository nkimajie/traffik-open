import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import { ClientSession } from "mongoose";
import { CartsRepository } from "../repositories/carts.repository";
import { ProductsService } from "../../products/services/products.service";
import { VouchersService } from "../../vouchers/services/vouchers.service";
import { AddCartItemDto } from "../dto/add-cart-item.dto";
import { UpdateCartItemDto } from "../dto/update-cart-item.dto";

import { BaseService } from "src/modules/shared/base/service.base";
import { PromisifiedOperationFeedback } from "src/modules/shared/types/promisified_operation_feedback.type";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import {
  CART_VENDOR_CONFLICT,
  ICart,
  ICartItem,
  ICartVendorConflict,
  ICartVendorSummary,
} from "../interfaces/cart.interface";
import { IProductVariation } from "../../products/interfaces/product.interface";
import { ProductDocument } from "../../products/schemas/product.schema";
import { discountsEqual } from "../../products/utils/product-discount.util";
import type { IProductDiscount } from "../../products/interfaces/product.interface";
import { CHECKOUT_LOCK_TTL_MS } from "../constants/checkout-lock.constant";

@Injectable()
export class CartsService extends BaseService {
  private readonly logger = new Logger(CartsService.name);

  constructor(
    private readonly cartsRepository: CartsRepository,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    private readonly vouchersService: VouchersService,
    private readonly utilsService: UtilsService,
  ) {
    super();
  }

  /**
   * Builds the store summary a client needs to label a cart, from the vendor
   * data `ProductsService` already joins onto every product it returns.
   */
  private toVendorSummary(product: ProductDocument): ICartVendorSummary {
    const vendor = (product as unknown as { vendor?: Record<string, unknown> })
      .vendor;
    const vendorId = String(vendor?._id ?? (product as any).vendorId ?? "");

    return {
      _id: vendorId,
      businessName: (vendor?.businessName as string) ?? undefined,
      storeLogo: (vendor?.storeLogo as string | null) ?? null,
      storeCoverPhoto: (vendor?.storeCoverPhoto as string | null) ?? null,
      isVerified: Boolean(vendor?.isVerified),
    };
  }

  /**
   * Re-syncs line list/final prices and discount snapshots from current product data.
   */
  private async syncCartPricesFromProducts(
    cart: ICart & { _id?: unknown },
  ): Promise<ICart | null> {
    const plainItems = (cart.items || []).map((it: any) =>
      this.toPlainCartItem(it),
    ) as unknown as ICartItem[];
    if (plainItems.length === 0) {
      return null;
    }

    const nextItems: ICartItem[] = [];
    let dirty = false;

    for (let i = 0; i < plainItems.length; i++) {
      const item = { ...plainItems[i] };
      const product = await this.productsService.findById(
        String(item.productId),
        undefined,
        { attachLatestReview: false },
      );
      if (!product) {
        nextItems.push(item);
        continue;
      }
      const { unitPrice, listUnitPrice, appliedDiscount } =
        this.productsService.resolveCartUnitPrice(product, item.variationId);
      const qty = item.quantity;
      const prevList = item.listUnitPrice ?? item.price;
      const prevDisc = item.discount as IProductDiscount | undefined;
      if (
        item.price !== unitPrice ||
        prevList !== listUnitPrice ||
        item.total !== qty * unitPrice ||
        !discountsEqual(prevDisc, appliedDiscount)
      ) {
        dirty = true;
      }
      const row: ICartItem = {
        ...item,
        listUnitPrice,
        price: unitPrice,
        total: Math.round((qty * unitPrice + Number.EPSILON) * 100) / 100,
      };
      if (appliedDiscount) {
        row.discount = appliedDiscount;
      } else {
        delete row.discount;
      }
      nextItems.push(row);
    }

    if (!dirty || !cart._id) {
      return null;
    }

    const nextCart = { ...cart, items: nextItems } as ICart;
    await this.calculateCartTotals(nextCart);

    return this.cartsRepository.update(
      { _id: cart._id },
      {
        items: nextCart.items,
        subtotal: nextCart.subtotal,
        hasVoucher: nextCart.hasVoucher,
        voucherId: nextCart.voucherId,
        voucher: nextCart.voucher,
      },
    );
  }

  private async calculateCartTotals(cart: ICart): Promise<void> {
    const baseSubtotal = cart.items.reduce(
      (total, item) => total + item.total,
      0,
    );
    cart.subtotal = baseSubtotal;

    if (cart.hasVoucher && cart.voucherId) {
      const vouchersResult = await this.vouchersService.findAll();
      if (!vouchersResult.failed && vouchersResult.data) {
        const voucher = vouchersResult.data.find(
          (v) => v._id.toString() === cart.voucherId.toString(),
        );
        if (voucher) {
          const discount = (baseSubtotal * (voucher.percentage || 0)) / 100;
          cart.subtotal = baseSubtotal - discount;
          cart.voucher = {
            name: voucher.name,
            code: voucher.code,
            percentage: voucher.percentage,
          };
        } else {
          cart.hasVoucher = false;
          cart.voucherId = null;
          cart.voucher = null as any;
        }
      }
    }

    // Round subtotal to two decimal places
    if (cart.subtotal != null && cart.subtotal !== 0) {
      cart.subtotal = Math.round((cart.subtotal + Number.EPSILON) * 100) / 100;
    }
  }

  async getCart(userId: string): PromisifiedOperationFeedback<ICart> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    let cart: any = await this.cartsRepository.query({ userId: objectUserId });

    if (!cart) {
      cart = await this.cartsRepository.create({
        userId: objectUserId as any,
        items: [],
        subtotal: 0,
        hasVoucher: false,
      });
    }

    const synced = await this.syncCartPricesFromProducts(
      cart as ICart & { _id?: unknown },
    );
    if (synced) {
      cart = synced as any;
    }

    const enriched = await this.enrichCartItemsWithVariationDetails(cart);
    return this.Result(false, "Cart retrieved successfully", enriched);
  }

  /** Converts a Mongoose document/subdocument to a plain object for API response. */
  private toPlainCartItem(item: any): Record<string, unknown> {
    if (item && typeof item.toObject === "function") {
      return item.toObject();
    }
    if (item && item._doc && typeof item._doc === "object") {
      return { ...item._doc };
    }
    const plain: Record<string, unknown> = {
      productId: item?.productId,
      variationId: item?.variationId,
      quantity: item?.quantity,
      listUnitPrice: item?.listUnitPrice ?? item?.price,
      price: item?.price,
      total: item?.total,
      ...(item?._id != null && { _id: item._id }),
    };
    if (item?.discount) {
      plain.discount = item.discount;
    }
    return plain;
  }

  /** Converts a Mongoose cart document to a plain object for API response. */
  private toPlainCart(cart: any): Record<string, unknown> {
    if (cart && typeof cart.toObject === "function") {
      return cart.toObject();
    }
    if (cart && typeof cart === "object") {
      const c = cart as Record<string, unknown>;
      const { __parentArray, __index, $__, _doc, $isNew, ...rest } = c;
      if (_doc && typeof _doc === "object") {
        return { ...(_doc as Record<string, unknown>), ...rest };
      }
      return rest as Record<string, unknown>;
    }
    return (cart ?? {}) as Record<string, unknown>;
  }

  /**
   * Attaches variation details to cart items: from product.variations when item has variationId,
   * or from product.defaultVariation when item has no variationId (hasVariations false).
   * Also attaches the cart's store, since a cart belongs to exactly one vendor.
   * Returns a plain object (no Mongoose internals) for safe JSON response.
   */
  private async enrichCartItemsWithVariationDetails(
    cart: ICart,
  ): Promise<ICart> {
    const plainCart = this.toPlainCart(cart) as unknown as ICart;
    const items = plainCart.items || [];
    if (items.length === 0) {
      return { ...plainCart, vendorId: null, vendor: null };
    }

    const productIds = [
      ...new Set(
        items.map(
          (item: any) => item?.productId?.toString?.() ?? item?.productId,
        ),
      ),
    ];
    const products = await Promise.all(
      productIds.map((id) =>
        this.productsService.findById(id, undefined, {
          attachLatestReview: false,
        }),
      ),
    );
    const productMap = new Map<string, ProductDocument>();
    productIds.forEach((id, i) => {
      const p = products[i];
      if (p) productMap.set(id, p);
    });

    let vendor: ICartVendorSummary | null = null;

    const enrichedItems: ICartItem[] = items.map((item: any) => {
      const base = this.toPlainCartItem(item) as unknown as ICartItem;
      const product = productMap.get(
        base.productId?.toString?.() ?? base.productId,
      );
      if (!product) return base;

      if (!vendor) {
        vendor = this.toVendorSummary(product);
      }
      base.vendorId = base.vendorId
        ? String(base.vendorId)
        : String((product as any).vendorId ?? "");

      const itemVarId = base.variationId?.toString?.() ?? base.variationId;
      if (itemVarId && product.variations?.length) {
        const variation = (
          product.variations as (IProductVariation & { _id?: any })[]
        ).find((v) => v._id && String(v._id) === itemVarId);
        if (variation) {
          return {
            ...base,
            variation: {
              _id: variation._id,
              name: variation.name,
              attributes: variation.attributes,
              price: variation.price,
              quantity: variation.quantity,
              ...((variation as any).discount && {
                discount: (variation as any).discount,
              }),
            },
          };
        }
      }
      if (!itemVarId && product.defaultVariation) {
        return {
          ...base,
          variation: {
            name: product.defaultVariation.name,
            attributes: product.defaultVariation.attributes ?? {},
            price: product.defaultVariation.price,
            quantity: product.defaultVariation.quantity,
            ...((product.defaultVariation as any).discount && {
              discount: (product.defaultVariation as any).discount,
            }),
          },
        };
      }
      return base;
    });

    return {
      ...plainCart,
      items: enrichedItems,
      vendorId: vendor ? (vendor as ICartVendorSummary)._id : null,
      vendor,
    };
  }

  private sameCartItem(
    item: ICart["items"][0],
    productId: string,
    variationId: string | undefined,
  ): boolean {
    if (item.productId.toString() !== productId) return false;
    const itemVarId = item.variationId?.toString?.() ?? item.variationId;
    if (
      variationId === undefined &&
      (itemVarId === undefined || itemVarId === "")
    )
      return true;
    return (
      variationId !== undefined &&
      itemVarId !== undefined &&
      itemVarId === variationId
    );
  }

  /**
   * The store a cart currently belongs to. Falls back to the lines themselves so
   * carts created before `vendorId` existed still resolve to a single store.
   */
  private async resolveCartVendorId(cart: {
    vendorId?: string | null;
    items: ICartItem[];
  }): Promise<string | null> {
    if (cart.vendorId) return String(cart.vendorId);
    if (!cart.items?.length) return null;

    const lineVendorId = cart.items.find((item) => item.vendorId)?.vendorId;
    if (lineVendorId) return String(lineVendorId);

    const firstProduct = await this.productsService.findById(
      String(cart.items[0].productId),
      undefined,
      { attachLatestReview: false },
    );
    return firstProduct ? String((firstProduct as any).vendorId ?? "") : null;
  }

  /** Store summary for the cart's existing lines, for conflict messaging. */
  private async vendorSummaryForCart(cart: {
    items: ICartItem[];
  }): Promise<ICartVendorSummary | null> {
    if (!cart.items?.length) return null;
    const product = await this.productsService.findById(
      String(cart.items[0].productId),
      undefined,
      { attachLatestReview: false },
    );
    return product ? this.toVendorSummary(product) : null;
  }

  async addItem(
    userId: string,
    addItemDto: AddCartItemDto,
  ): PromisifiedOperationFeedback<ICart | ICartVendorConflict> {
    const objectUserId = this.utilsService.objectIdFromString(userId);

    const product = await this.productsService.findById(
      addItemDto.productId,
      undefined,
      { attachLatestReview: false },
    );
    if (!product) {
      return this.Result(true, "Product not found", undefined, 404);
    }

    let availableQuantity: number;
    let variationId: string | undefined;

    if (product.hasVariations && product.variations?.length) {
      if (
        addItemDto.variationId == null ||
        String(addItemDto.variationId).trim() === ""
      ) {
        return this.Result(
          true,
          "Variation must be selected for this product",
          undefined,
          400,
        );
      }
      const variation = (product.variations as Array<{ _id?: any }>).find(
        (v) => v._id && v._id.toString() === addItemDto.variationId,
      );
      if (!variation) {
        return this.Result(
          true,
          "Invalid variation selected for this product",
          undefined,
          400,
        );
      }
      const v = variation as (typeof product.variations)[0];
      availableQuantity = v.quantity ?? 0;
      variationId = addItemDto.variationId;
    } else {
      if (
        addItemDto.variationId != null &&
        String(addItemDto.variationId).trim() !== ""
      ) {
        return this.Result(
          true,
          "This product has no variations; do not send variationId",
          undefined,
          400,
        );
      }
      if (!product.defaultVariation) {
        return this.Result(
          true,
          "Product has no default variation",
          undefined,
          400,
        );
      }
      availableQuantity = product.defaultVariation.quantity ?? 0;
    }

    const { unitPrice, listUnitPrice, appliedDiscount } =
      this.productsService.resolveCartUnitPrice(product, variationId);

    let cart = await this.cartsRepository.query({ userId: objectUserId });
    if (!cart) {
      cart = await this.cartsRepository.create({
        userId: objectUserId as any,
        items: [],
        subtotal: 0,
        hasVoucher: false,
      });
    }

    // A cart holds one store at a time, so mixing stores is rejected with the
    // detail the client needs to offer save-for-later or replace.
    const incomingVendorId = String((product as any).vendorId ?? "");
    const currentVendorId = await this.resolveCartVendorId(cart);

    if (cart.items.length > 0 && currentVendorId && incomingVendorId) {
      if (currentVendorId !== incomingVendorId) {
        const currentVendor = await this.vendorSummaryForCart(cart);
        const conflict: ICartVendorConflict = {
          code: CART_VENDOR_CONFLICT,
          currentVendor: currentVendor ?? { _id: currentVendorId },
          incomingVendor: this.toVendorSummary(product),
          incomingProductId: addItemDto.productId,
          ...(variationId !== undefined && {
            incomingVariationId: variationId,
          }),
          incomingQuantity: addItemDto.quantity,
        };

        return this.Result(
          true,
          `Your cart already has items from ${
            currentVendor?.businessName ?? "another store"
          }. You can only order from one store at a time.`,
          conflict,
          409,
        );
      }
    }

    const itemIndex = cart.items.findIndex((item) =>
      this.sameCartItem(item, addItemDto.productId, variationId),
    );
    const existingQty = itemIndex > -1 ? cart.items[itemIndex].quantity : 0;
    const newTotalQty = existingQty + addItemDto.quantity;

    if (newTotalQty > availableQuantity) {
      return this.Result(
        true,
        `Insufficient stock. Available: ${availableQuantity}, requested: ${newTotalQty}`,
        undefined,
        400,
      );
    }

    if (itemIndex > -1) {
      const existingItem = cart.items[itemIndex] as any;
      existingItem.quantity = newTotalQty;
      existingItem.listUnitPrice = listUnitPrice;
      existingItem.price = unitPrice;
      existingItem.vendorId = incomingVendorId || existingItem.vendorId;
      existingItem.total =
        Math.round((existingItem.quantity * unitPrice + Number.EPSILON) * 100) /
        100;
      if (appliedDiscount) {
        existingItem.discount = appliedDiscount;
      } else {
        delete existingItem.discount;
      }
      cart.items[itemIndex] = existingItem;
    } else {
      const newLine: Record<string, unknown> = {
        productId: addItemDto.productId,
        ...(variationId !== undefined && { variationId }),
        ...(incomingVendorId && { vendorId: incomingVendorId }),
        quantity: addItemDto.quantity,
        listUnitPrice,
        price: unitPrice,
        total:
          Math.round((addItemDto.quantity * unitPrice + Number.EPSILON) * 100) /
          100,
      };
      if (appliedDiscount) {
        newLine.discount = appliedDiscount;
      }
      cart.items.push(newLine as any);
    }

    await this.calculateCartTotals(cart);

    const updatedCart = await this.cartsRepository.update(
      { _id: cart._id },
      {
        items: cart.items,
        subtotal: cart.subtotal,
        hasVoucher: cart.hasVoucher,
        voucherId: cart.voucherId,
        voucher: cart.voucher,
        ...(incomingVendorId && { vendorId: incomingVendorId }),
      },
    );

    const enriched =
      await this.enrichCartItemsWithVariationDetails(updatedCart);
    return this.Result(false, "Item added to cart", enriched);
  }

  async updateItemQuantity(
    userId: string,
    productId: string,
    updateDto: UpdateCartItemDto,
    variationId?: string,
  ): PromisifiedOperationFeedback<ICart> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const cart = await this.cartsRepository.query({ userId: objectUserId });

    if (!cart) {
      return this.Result(true, "Cart not found", undefined, 404);
    }

    const itemIndex = cart.items.findIndex((item) =>
      this.sameCartItem(item, productId, variationId),
    );

    if (itemIndex === -1) {
      return this.Result(true, "Item not found in cart", undefined, 404);
    }

    const product = await this.productsService.findById(productId, undefined, {
      attachLatestReview: false,
    });
    if (!product) {
      return this.Result(true, "Product not found", undefined, 404);
    }

    let availableQuantity: number;
    if (product.hasVariations && product.variations?.length) {
      const itemVarId =
        cart.items[itemIndex].variationId?.toString?.() ??
        cart.items[itemIndex].variationId;
      const variation = (product.variations as Array<{ _id?: any }>).find(
        (v) => v._id && v._id.toString() === itemVarId,
      );
      if (!variation) {
        return this.Result(
          true,
          "Invalid variation on cart item",
          undefined,
          400,
        );
      }
      availableQuantity =
        (variation as (typeof product.variations)[0]).quantity ?? 0;
    } else {
      if (!product.defaultVariation) {
        return this.Result(
          true,
          "Product has no default variation",
          undefined,
          400,
        );
      }
      availableQuantity = product.defaultVariation.quantity ?? 0;
    }

    if (updateDto.quantity > availableQuantity) {
      return this.Result(
        true,
        `Insufficient stock. Available: ${availableQuantity}`,
        undefined,
        400,
      );
    }

    const itemVarIdForPrice =
      cart.items[itemIndex].variationId?.toString?.() ??
      cart.items[itemIndex].variationId;
    const { unitPrice, listUnitPrice, appliedDiscount } =
      this.productsService.resolveCartUnitPrice(product, itemVarIdForPrice);

    const line = cart.items[itemIndex] as any;
    line.quantity = updateDto.quantity;
    line.listUnitPrice = listUnitPrice;
    line.price = unitPrice;
    line.total =
      Math.round((line.quantity * unitPrice + Number.EPSILON) * 100) / 100;
    if (appliedDiscount) {
      line.discount = appliedDiscount;
    } else {
      delete line.discount;
    }
    cart.items[itemIndex] = line;

    await this.calculateCartTotals(cart);

    const updatedCart = await this.cartsRepository.update(
      { _id: cart._id },
      {
        items: cart.items,
        subtotal: cart.subtotal,
        hasVoucher: cart.hasVoucher,
        voucherId: cart.voucherId,
        voucher: cart.voucher,
      },
    );

    const enriched =
      await this.enrichCartItemsWithVariationDetails(updatedCart);
    return this.Result(false, "Cart item updated", enriched);
  }

  async removeItem(
    userId: string,
    productId: string,
    variationId?: string,
  ): PromisifiedOperationFeedback<ICart> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const cart = await this.cartsRepository.query({ userId: objectUserId });

    if (!cart) {
      return this.Result(true, "Cart not found", undefined, 404);
    }

    const initialItemCount = cart.items.length;
    cart.items = cart.items.filter(
      (item) => !this.sameCartItem(item, productId, variationId),
    );

    if (cart.items.length === initialItemCount) {
      // Nothing was removed. Determine why for a better error message.
      const anyItemForProduct = cart.items.find(
        (item) => item.productId.toString() === productId,
      );

      if (anyItemForProduct) {
        const itemVarId =
          anyItemForProduct.variationId?.toString?.() ??
          anyItemForProduct.variationId;

        if (!variationId && itemVarId) {
          return this.Result(
            true,
            "variationId query param is required for this product",
            undefined,
            400,
          );
        }
        return this.Result(
          true,
          "Specified item variation not found in cart",
          undefined,
          404,
        );
      }
      return this.Result(true, "Item not found in cart", undefined, 404);
    }

    // An empty cart is no longer tied to a store, and loses any voucher.
    const isNowEmpty = cart.items.length === 0;
    if (isNowEmpty) {
      cart.hasVoucher = false;
      cart.voucherId = null;
      cart.voucher = null as any;
    }

    await this.calculateCartTotals(cart);

    const updatedCart = await this.cartsRepository.update(
      { _id: cart._id },
      {
        items: cart.items,
        subtotal: cart.subtotal,
        hasVoucher: cart.hasVoucher,
        voucherId: cart.voucherId,
        voucher: cart.voucher,
        ...(isNowEmpty && { vendorId: null }),
      },
    );

    const enriched =
      await this.enrichCartItemsWithVariationDetails(updatedCart);
    return this.Result(false, "Item removed from cart", enriched);
  }

  async applyVoucher(
    userId: string,
    code: string,
  ): PromisifiedOperationFeedback<ICart> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const cart = await this.cartsRepository.query({ userId: objectUserId });

    if (!cart || cart.items.length === 0) {
      return this.Result(true, "Cart is empty", undefined, 400);
    }

    if (cart.hasVoucher) {
      return this.Result(
        true,
        "A voucher is already applied to this cart. Only one voucher per cart is allowed.",
        undefined,
        400,
      );
    }

    // Get all vouchers first to find the one matching the code
    const vouchersResult = await this.vouchersService.findAll();
    if (vouchersResult.failed) {
      return this.Result(true, "Failed to validate voucher", undefined, 500);
    }

    const voucher = vouchersResult.data.find(
      (v) => v.code.toUpperCase() === code.toUpperCase(),
    );

    if (!voucher) {
      return this.Result(
        true,
        "Invalid or expired voucher code",
        undefined,
        400,
      );
    }

    cart.hasVoucher = true;
    cart.voucherId = voucher._id;
    cart.voucher = {
      name: voucher.name,
      code: voucher.code,
      percentage: voucher.percentage,
    };

    await this.calculateCartTotals(cart);

    const updatedCart = await this.cartsRepository.update(
      { _id: cart._id },
      {
        hasVoucher: true,
        voucherId: voucher._id,
        subtotal: cart.subtotal,
        voucher: cart.voucher,
      },
    );

    const enriched =
      await this.enrichCartItemsWithVariationDetails(updatedCart);
    return this.Result(false, "Voucher applied successfully", enriched);
  }

  /**
   * Serialises checkouts per shopper. Returns a token to pass to
   * {@link releaseCheckoutLock}, or null if a checkout is already running.
   */
  async acquireCheckoutLock(userId: string): Promise<string | null> {
    return this.cartsRepository.acquireCheckoutLock(
      this.utilsService.objectIdFromString(userId),
      CHECKOUT_LOCK_TTL_MS,
    );
  }

  /**
   * Whether `token` still holds the shopper's checkout lock (extending it if
   * so). Checked when the order is saved, inside its transaction.
   */
  async confirmCheckoutLock(
    userId: string,
    token: string,
    session?: ClientSession,
  ): Promise<boolean> {
    return this.cartsRepository.confirmCheckoutLock(
      this.utilsService.objectIdFromString(userId),
      token,
      CHECKOUT_LOCK_TTL_MS,
      session,
    );
  }

  async releaseCheckoutLock(userId: string, token: string): Promise<void> {
    await this.cartsRepository.releaseCheckoutLock(
      this.utilsService.objectIdFromString(userId),
      token,
    );
  }

  async clearCart(userId: string): PromisifiedOperationFeedback<ICart> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const cart = await this.cartsRepository.query({ userId: objectUserId });

    if (!cart) {
      return this.Result(true, "Cart not found", undefined, 404);
    }

    const updatedCart = await this.cartsRepository.update(
      { _id: cart._id },
      {
        items: [],
        subtotal: 0,
        hasVoucher: false,
        voucherId: null,
        voucher: null as any,
        vendorId: null,
      },
    );

    const enriched =
      await this.enrichCartItemsWithVariationDetails(updatedCart);
    return this.Result(false, "Cart cleared", enriched);
  }

  /**
   * Resolution for a store conflict that keeps the cart: the product the shopper
   * could not add is saved instead, so nothing is silently lost.
   */
  async saveItemForLater(
    userId: string,
    productId: string,
  ): PromisifiedOperationFeedback<{ cart: ICart; savedCount: number }> {
    const saved = await this.productsService.saveProductAsFavorite(
      userId,
      productId,
    );

    // "Already saved" is a success for this flow — the shopper's intent is met.
    const alreadySaved = saved.failed && /already/i.test(saved.description);
    if (saved.failed && !alreadySaved) {
      return this.Result(true, saved.description, undefined, saved.code ?? 400);
    }

    const cartResult = await this.getCart(userId);
    if (cartResult.failed) {
      return this.Result(
        true,
        cartResult.description,
        undefined,
        cartResult.code,
      );
    }

    return this.Result(false, "Product saved for later", {
      cart: cartResult.data,
      savedCount: 1,
    });
  }

  /**
   * Resolution for a store conflict that switches stores: the current lines are
   * saved rather than discarded, then the cart restarts with the new product.
   */
  async replaceCart(
    userId: string,
    addItemDto: AddCartItemDto,
  ): PromisifiedOperationFeedback<{ cart: ICart; savedCount: number }> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const cart = await this.cartsRepository.query({ userId: objectUserId });

    let savedCount = 0;
    const productIds = [
      ...new Set(
        (cart?.items ?? []).map((item) => String(item.productId)),
      ),
    ];

    for (const productId of productIds) {
      const saved = await this.productsService.saveProductAsFavorite(
        userId,
        productId,
      );
      if (!saved.failed || /already/i.test(saved.description)) {
        savedCount += 1;
      }
    }

    if (cart) {
      const cleared = await this.clearCart(userId);
      if (cleared.failed) {
        return this.Result(true, cleared.description, undefined, cleared.code);
      }
    }

    const added = await this.addItem(userId, addItemDto);
    if (added.failed) {
      return this.Result(true, added.description, undefined, added.code);
    }

    return this.Result(false, "Cart replaced", {
      cart: added.data as ICart,
      savedCount,
    });
  }
}
