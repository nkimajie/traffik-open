import { Injectable, Logger } from "@nestjs/common";
import { ClientSession, PipelineStage, Types } from "mongoose";
import { OrdersRepository } from "../repositories/orders.repository";
import { CheckoutPreviewDto, CreateOrderDto } from "../dto/checkout.dto";
import { DeliveryMethod, OrderStatus } from "../enums/order.enum";
import { OrderDocument } from "../schemas/order.schema";
import { BaseService } from "src/modules/shared/base/service.base";
import { PromisifiedOperationFeedback } from "src/modules/shared/types/promisified_operation_feedback.type";
import { OperationFeedback } from "src/modules/shared/interfaces/operation_feedback.interface";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { CartsService } from "../../carts/services/carts.service";
import { AddressesService } from "../../addresses/services/addresses.service";
import { IPaginationQuery } from "src/modules/shared/interfaces/pagination_query.interface";
import { IOrder } from "../interfaces/order.interface";
import { IPendingReviewLineItem } from "../interfaces/pending-review-line-item.interface";
import { PaginatedResponse } from "src/common/interfaces/paginated-response.interface";
import { PaginationOptions } from "src/common/interfaces/pagination-options.interface";
import { DBCollectionNames } from "src/modules/shared/enums/db_collections_name.enum";
import { ProductStatus } from "src/modules/products/enums/product-status.enum";
import { EmailService } from "src/modules/shared/services/email/email.service";
import { EmailTemplate } from "src/modules/shared/services/email/enums/email_template.enum";
import {
  getAppWebUrl,
  getOrderStatusLabel,
} from "src/modules/shared/services/email/email.helpers";
import { EmailOrderLine } from "src/modules/shared/services/email/interfaces/email_template.interface";
import { UsersRepository } from "src/modules/users/repositories/users.repository";
import { ProductsRepository } from "src/modules/products/repositories/products.repository";
import { VendorsRepository } from "src/modules/vendors/repositories/vendors.repository";
import { ICartItem } from "../../carts/interfaces/cart.interface";
import { isStoreOpen } from "src/modules/shared/utils/business-hours.util";
import {
  PAID_UNSHIPPED_ORDER_STATUSES,
  SHIPPED_ORDER_STATUSES,
  SHOPPER_CANCELLABLE_ORDER_STATUSES,
  STOCK_RELEASING_ORDER_STATUSES,
  UNFULFILLED_ORDER_STATUSES,
  VENDOR_ORDER_TRANSITIONS,
  canTransitionOrderStatus,
} from "../enums/order.enum";
import { KashiaService } from "../../escrow/services/kashia.service";
import { koboToNaira, nairaToKobo } from "../../escrow/utils/money.util";
import { PlatformSettingsService } from "../../admin/services/platform-settings.service";
import {
  OrderPaymentVerificationResult,
  OrderPaymentVerificationStatus,
  PaymentReturnSummary,
} from "../interfaces/order-payment-verification.interface";
import {
  isKashiaPaymentLinkFailed,
  isKashiaPaymentLinkPaid,
} from "../../escrow/utils/kashia-payment-link.util";
import {
  CancelPendingPaymentOptions,
  IOrderPaymentAlert,
  OrderEscrowEvent,
  OrderEscrowFields,
  OrderPaymentConfirmation,
  UpdateOrderEscrowOptions,
} from "../interfaces/order-escrow.interface";
import {
  EscrowLifecycleEvent,
  OrderPaymentAlertType,
} from "../enums/order-escrow.enum";
import {
  AbandonedCheckoutSweepResult,
  OrderCreation,
  OrderTransitionOptions,
  PendingPaymentSettlement,
  StockReservationResult,
} from "../interfaces/order-inventory.interface";
import {
  CheckoutCalculation,
  CheckoutCalculationResult,
} from "../interfaces/checkout.interface";
import {
  OrderRefundActor,
  OrderRefundPayoutMethod,
  OrderRefundReason,
  OrderRefundResolution,
  OrderRefundStatus,
} from "../enums/order-refund.enum";
import {
  EscrowRefundedEvent,
  EscrowRefundedOutcome,
  IOrderRefund,
  ManualRefundEvidence,
  NewOrderRefund,
} from "../interfaces/order-refund.interface";
import {
  newRefundRecord,
  normalizePayoutReference,
} from "../utils/order-refund.util";
import {
  REFUND_NOT_RECEIVED_WINDOW_DAYS,
  REFUND_NOT_RECEIVED_WINDOW_MS,
  REFUND_PAYOUT_METHOD_LABELS,
} from "../constants/order-refund.constant";
import { RefundPayoutReferencesRepository } from "../repositories/refund-payout-references.repository";
import { TransactionsService } from "src/modules/shared/services/transactions/transactions.service";
import {
  PENDING_PAYMENT_HOLD_MS,
  PENDING_PAYMENT_MAX_HOLD_MS,
  STALE_HOLD_RECHECK_MS,
  STALE_HOLD_RECLAIM_LIMIT,
  STALE_HOLD_SWEEP_BUDGET_MS,
  CHECKOUT_RECLAIM_BUDGET_MS,
} from "../constants/order-inventory.constant";

/** Aborts the checkout transaction when a line cannot be reserved. */
class StockShortageError extends Error {
  constructor(readonly item: ICartItem) {
    super("Not enough stock");
  }
}

/** Aborts the checkout transaction when the checkout lock was lost. */
class CheckoutLockLostError extends Error {
  constructor() {
    super("Checkout lock lost");
  }
}

/** Returned by an escrow-event step when the order changed underneath it. */
const ESCROW_EVENT_RETRY = "__retry__";
/** Re-reads of the order before a changing order is left to webhook redelivery. */
const ESCROW_EVENT_MAX_ATTEMPTS = 3;

/** Order statuses included when listing pending reviews with no `status` query. */
export const DEFAULT_PENDING_REVIEW_ORDER_STATUSES: OrderStatus[] = [
  // OrderStatus.PROCESSING,
  OrderStatus.DELIVERED,
  // OrderStatus.CANCELLED,
];

@Injectable()
export class OrdersService extends BaseService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly utilsService: UtilsService,
    private readonly cartsService: CartsService,
    private readonly addressesService: AddressesService,
    private readonly emailService: EmailService,
    private readonly usersRepository: UsersRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly vendorsRepository: VendorsRepository,
    private readonly kashiaService: KashiaService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly refundPayoutReferences: RefundPayoutReferencesRepository,
    private readonly transactions: TransactionsService,
  ) {
    super();
  }

  private async calculateCheckout(
    userId: string,
    previewDto: CheckoutPreviewDto,
  ): Promise<CheckoutCalculationResult> {
    // 1. Fetch Cart
    const cartResult = await this.cartsService.getCart(userId);
    if (cartResult.failed) {
      throw new Error(cartResult.description);
    }
    const cart = cartResult.data;

    if (!cart || cart.items.length === 0) {
      return { error: "Cart is empty" };
    }

    // 2. Fetch Address
    const addressResult = await this.addressesService.getAddressById(
      userId,
      previewDto.addressId,
    );
    if (addressResult.failed) {
      return { error: "Shipping address not found" };
    }
    const address = addressResult.data;

    // 3. Resolve the store. A cart is store-scoped, so exactly one vendor owns
    // the order, and that store's own rules govern delivery and minimums.
    const vendorId = cart.vendorId ? String(cart.vendorId) : null;
    if (!vendorId) {
      return { error: "Cart is not linked to a store" };
    }

    const vendor = await this.vendorsRepository.query({ _id: vendorId });
    if (!vendor) {
      return { error: "Store not found" };
    }
    if (vendor.isActive === false || vendor.isApproved === false) {
      return { error: `${vendor.businessName ?? "This store"} is not currently accepting orders` };
    }
    if (!isStoreOpen(vendor.businessHours)) {
      return {
        error: `${vendor.businessName ?? "This store"} is closed right now. Please try again during opening hours.`,
      };
    }

    // 4. Every line must still be a live product of this store.
    const itemsError = await this.validateCheckoutItems(cart.items, vendorId);
    if (itemsError) {
      return { error: itemsError };
    }

    // 5. Calculate Totals
    let subtotal = cart.items.reduce((acc, item) => acc + item.total, 0);
    subtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;

    const minimumOrderValue = vendor.minimumOrderValue ?? 0;
    if (minimumOrderValue > 0 && subtotal < minimumOrderValue) {
      return {
        error: `${vendor.businessName ?? "This store"} has a minimum order of ${minimumOrderValue}. Add ${Math.ceil(minimumOrderValue - subtotal)} more to check out.`,
      };
    }

    if (
      previewDto.deliveryMethod === DeliveryMethod.PICKUP_STATION &&
      vendor.pickupAvailable === false
    ) {
      return {
        error: `${vendor.businessName ?? "This store"} does not offer pickup. Choose door delivery instead.`,
      };
    }

    // Delivery is the store's own fee, so it is paid to the store rather than
    // being a platform charge.
    const shippingFee =
      previewDto.deliveryMethod === DeliveryMethod.DOOR_DELIVERY
        ? (vendor.deliveryFee ?? 0)
        : 0;

    let discount = 0;
    if (cart.hasVoucher && cart.voucher) {
      discount = (subtotal * cart.voucher.percentage) / 100;
      discount = Math.round((discount + Number.EPSILON) * 100) / 100;
    }

    let total = subtotal + shippingFee - discount;
    total = Math.round((total + Number.EPSILON) * 100) / 100;

    if (total <= 0) {
      return { error: "Order total must be greater than zero." };
    }

    return {
      data: {
        userId,
        vendorId,
        items: cart.items,
        shippingAddress: address,
        deliveryMethod: previewDto.deliveryMethod,
        subtotal,
        discount,
        shippingFee,
        total,
        voucherId: cart.voucherId,
        voucher: cart.voucher,
      },
    };
  }

  /**
   * Checks cart lines against the catalogue before anything is reserved:
   * quantities are whole and positive, and each product still exists, is on
   * sale, belongs to the checkout's store, and still has the chosen option.
   * Stock levels are enforced by the reservation itself.
   *
   * @returns a message for the shopper, or null when the lines are valid.
   */
  private async validateCheckoutItems(
    items: ICartItem[],
    vendorId: string,
  ): Promise<string | null> {
    if (
      items.some(
        (item) => !Number.isInteger(item.quantity) || item.quantity < 1,
      )
    ) {
      return "An item in your cart has an invalid quantity. Please update your cart.";
    }

    const productIds = [
      ...new Set(items.map((item) => String(item.productId))),
    ];
    const products = await this.productsRepository.model
      .find({
        _id: {
          $in: productIds.map((id) => this.utilsService.objectIdFromString(id)),
        },
      })
      .select("name status vendorId variations._id")
      .lean();
    const productsById = new Map(
      products.map((product) => [String(product._id), product]),
    );

    for (const item of items) {
      const product = productsById.get(String(item.productId));

      // Products without a status predate the field and are treated as live.
      if (
        !product ||
        (product.status && product.status !== ProductStatus.ACTIVE)
      ) {
        return `${product ? `"${product.name}"` : "An item in your cart"} is no longer available. Remove it from your cart to continue.`;
      }

      if (String(product.vendorId) !== vendorId) {
        return "Your cart has items from more than one store. Please review your cart.";
      }

      if (
        item.variationId &&
        !(product.variations || []).some(
          (variation) => String(variation._id) === String(item.variationId),
        )
      ) {
        return `The option you chose for "${product.name}" is no longer available. Please update your cart.`;
      }
    }

    return null;
  }

  async previewOrder(
    userId: string,
    previewDto: CheckoutPreviewDto,
  ): PromisifiedOperationFeedback<any> {
    const calculation = await this.calculateCheckout(userId, previewDto);
    if (calculation.error) {
      return this.Result(true, calculation.error, undefined, 400);
    }

    // Return the calculated data without saving
    return this.Result(false, "Order preview generated", calculation.data);
  }

  /**
   * Moves stock for one line by `delta`. Negative values reserve and are
   * guarded so concurrent checkouts cannot drive quantity below zero; positive
   * values return stock and are unconditional.
   *
   * Returns false when a reservation could not be satisfied.
   */
  private async adjustLineStock(
    item: ICartItem,
    delta: number,
    session?: ClientSession,
  ): Promise<boolean> {
    const productId = this.utilsService.objectIdFromString(
      String(item.productId),
    );
    const variationId = item.variationId
      ? this.utilsService.objectIdFromString(String(item.variationId))
      : null;
    const required = delta < 0 ? -delta : 0;

    if (variationId) {
      const result = await this.productsRepository.model.updateOne(
        {
          _id: productId,
          variations: {
            $elemMatch: {
              _id: variationId,
              ...(required > 0 && { quantity: { $gte: required } }),
            },
          },
        },
        { $inc: { "variations.$.quantity": delta } },
        { session },
      );
      return result.modifiedCount > 0;
    }

    const result = await this.productsRepository.model.updateOne(
      {
        _id: productId,
        ...(required > 0 && {
          "defaultVariation.quantity": { $gte: required },
        }),
      },
      { $inc: { "defaultVariation.quantity": delta } },
      { session },
    );
    return result.modifiedCount > 0;
  }

  /**
   * Holds inventory for an order that has not been paid for yet. Each line is a
   * conditional decrement, so concurrent checkouts cannot oversell.
   *
   * Rolls back its own partial work so a failure leaves inventory untouched.
   */
  private async reserveStockForItems(
    items: ICartItem[],
    session?: ClientSession,
  ): Promise<StockReservationResult> {
    const reserved: ICartItem[] = [];

    for (const item of items) {
      const ok = await this.adjustLineStock(item, -item.quantity, session);
      if (!ok) {
        await this.releaseStockForItems(reserved, session);
        return { failedItem: item };
      }
      reserved.push(item);
    }

    return {};
  }

  /**
   * Reserves the checkout's stock and saves its order as one transaction, so
   * a crash part-way leaves neither (not stock held by no order). The write
   * is refused if the checkout no longer holds the shopper's checkout lock
   * (it may have expired during a slow checkout and been taken by another),
   * so two checkouts cannot both save an order.
   *
   * If a line is short, frees stock held by abandoned unpaid orders for that
   * product and tries once more.
   */
  private async createOrderWithStock(
    order: Partial<OrderDocument>,
    items: ICartItem[],
    userId: string,
    lockToken: string,
  ): Promise<OrderCreation> {
    const attempt = async (): Promise<OrderCreation> => {
      try {
        const created = await this.transactions.run((session) =>
          this.reserveAndInsertOrder(order, items, userId, lockToken, session),
        );
        return { order: created };
      } catch (error) {
        if (error instanceof StockShortageError) {
          return { failedItem: error.item };
        }
        if (error instanceof CheckoutLockLostError) {
          return { lockLost: true };
        }
        throw error;
      }
    };

    const first = await attempt();
    if (!first.failedItem) {
      return first;
    }

    await this.reclaimStaleStockHolds([String(first.failedItem.productId)], {
      timeBudgetMs: CHECKOUT_RECLAIM_BUDGET_MS,
    });
    // Tried again even if this call released nothing: the sweep of abandoned
    // checkouts (or another checkout) may have just cancelled a stale hold on
    // this product and be returning its stock. A failed attempt changes
    // nothing, so this is safe.
    return attempt();
  }

  /** The writes of {@link createOrderWithStock}, in `session` when there is one. */
  private async reserveAndInsertOrder(
    order: Partial<OrderDocument>,
    items: ICartItem[],
    userId: string,
    lockToken: string,
    session?: ClientSession,
  ): Promise<OrderDocument> {
    const reservation = await this.reserveStockForItems(items, session);
    if (reservation.failedItem) {
      throw new StockShortageError(reservation.failedItem);
    }

    try {
      const stillOurs = await this.cartsService.confirmCheckoutLock(
        userId,
        lockToken,
        session,
      );
      if (!stillOurs) {
        throw new CheckoutLockLostError();
      }
      return await this.ordersRepository.insertOrder(order, session);
    } catch (error) {
      // Without a transaction to undo the reservation, return the stock here.
      if (!session) {
        await this.releaseStockForItems(items);
      }
      throw error;
    }
  }

  /** Tells the shopper which line is short and how many are left. */
  private async describeStockShortage(item: ICartItem): Promise<string> {
    const product = await this.productsRepository.model
      .findById(this.utilsService.objectIdFromString(String(item.productId)))
      .select(
        "name variations._id variations.quantity defaultVariation.quantity",
      )
      .lean();

    const name = product?.name ? `"${product.name}"` : "An item in your cart";
    const available = item.variationId
      ? ((product?.variations || []).find(
          (variation) => String(variation._id) === String(item.variationId),
        )?.quantity ?? 0)
      : (product?.defaultVariation?.quantity ?? 0);

    return available > 0
      ? `Only ${available} of ${name} left. Reduce the quantity in your cart and try again.`
      : `${name} is out of stock. Remove it from your cart to continue.`;
  }

  /** Returns held inventory when an order is abandoned, cancelled or declined. */
  private async releaseStockForItems(
    items: ICartItem[],
    session?: ClientSession,
  ): Promise<void> {
    for (const item of items) {
      if (session) {
        // Part of a transaction: a failure must abort it, so the change that
        // released the stock is rolled back with it rather than applied alone.
        await this.adjustLineStock(item, item.quantity, session);
        continue;
      }
      try {
        await this.adjustLineStock(item, item.quantity);
      } catch (error) {
        this.logger.error(
          `releaseStockForItems: failed for product ${String(item.productId)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  /**
   * Human-readable, collision-resistant reference. Crockford-style alphabet with
   * the ambiguous characters removed so references survive being read aloud to
   * support.
   */
  private async generateOrderRef(): Promise<string> {
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    for (let attempt = 0; attempt < 5; attempt++) {
      let suffix = "";
      for (let i = 0; i < 6; i++) {
        suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      const candidate = `TRF-${suffix}`;
      const existing = await this.ordersRepository.query({
        orderRef: candidate,
      });
      if (!existing) return candidate;
    }

    // Astronomically unlikely; fall back to something guaranteed unique.
    return `TRF-${Date.now().toString(36).toUpperCase()}`;
  }

  /**
   * Places an order for the shopper's cart and opens payment.
   *
   * Runs under a per-shopper checkout lock so a repeated submit cannot reserve
   * stock twice or open duplicate orders.
   */
  async createOrder(
    userId: string,
    createDto: CreateOrderDto,
  ): PromisifiedOperationFeedback<OrderDocument> {
    const calculation = await this.calculateCheckout(userId, createDto);
    if (calculation.error) {
      return this.Result(true, calculation.error, undefined, 400);
    }

    const lockToken = await this.cartsService.acquireCheckoutLock(userId);
    if (!lockToken) {
      return this.Result(
        true,
        "A checkout is already in progress. Please wait a moment and try again.",
        undefined,
        409,
      );
    }

    try {
      return await this.placeOrder(
        userId,
        createDto,
        calculation.data,
        lockToken,
      );
    } finally {
      await this.cartsService
        .releaseCheckoutLock(userId, lockToken)
        .catch((error) =>
          this.logger.error(
            `Failed to release checkout lock for user ${userId}`,
            error,
          ),
        );
    }
  }

  private async placeOrder(
    userId: string,
    createDto: CreateOrderDto,
    orderData: CheckoutCalculation,
    lockToken: string,
  ): PromisifiedOperationFeedback<OrderDocument> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectVendorId = this.utilsService.objectIdFromString(
      orderData.vendorId,
    );

    const openCheckout = await this.resolveOpenCheckouts(
      objectUserId,
      objectVendorId,
      createDto,
      orderData,
    );
    if (openCheckout) {
      return openCheckout;
    }

    // Stock is reserved as the order is saved: if it has gone since the item
    // was added to the cart, the shopper must not reach a payment page.
    // Opens as PENDING_PAYMENT: nothing is promised to the store, the cart is
    // kept, and no confirmation is sent until payment is actually captured.
    let creation: OrderCreation;
    try {
      creation = await this.createOrderWithStock(
        {
          ...orderData,
          userId: objectUserId as any,
          vendorId: objectVendorId as any,
          orderRef: await this.generateOrderRef(),
          status: OrderStatus.PENDING_PAYMENT,
          stockReserved: true,
          stockCommitted: false,
          timeline: [
            {
              status: OrderStatus.PENDING_PAYMENT,
              description: "Order placed, awaiting payment",
              date: new Date(),
            },
          ],
        },
        orderData.items,
        userId,
        lockToken,
      );
    } catch (error) {
      // Nothing was saved: the transaction rolled back (or, without one, the
      // reservation was returned).
      this.logger.error(`Order could not be saved for user ${userId}`, error);
      return this.Result(
        true,
        "We couldn't place your order. Please try again.",
        undefined,
        500,
      );
    }

    if (creation.failedItem) {
      return this.Result(
        true,
        await this.describeStockShortage(creation.failedItem),
        undefined,
        409,
      );
    }
    if (creation.lockLost) {
      this.logger.warn(
        `Checkout for user ${userId} outlived its checkout lock; another checkout took over, so nothing was saved`,
      );
      return this.Result(
        true,
        "A checkout is already in progress. Please wait a moment and try again.",
        undefined,
        409,
      );
    }
    let newOrder = creation.order;

    if (this.kashiaService.isConfigured()) {
      try {
        newOrder = await this.attachKashiaPaymentLink(newOrder, userId);
      } catch (error) {
        this.logger.error(
          `Kashia payment link failed for order ${String(newOrder._id as Types.ObjectId)}`,
          error,
        );
        await this.applyStatusTransition(
          newOrder,
          OrderStatus.CANCELLED,
          "Payment setup failed",
        );
        return this.Result(
          true,
          "Unable to start payment. Please try again.",
          undefined,
          502,
        );
      }
    }

    return this.Result(false, "Order created successfully", newOrder, 201);
  }

  /**
   * Deals with the shopper's earlier unpaid checkouts with the same store
   * before a new one reserves stock:
   * - paid in the meantime: stop, so the shopper does not order twice;
   * - identical to this checkout: hand it back instead of holding stock twice;
   * - different: cancel it so it stops holding stock.
   *
   * @returns a result to return to the shopper, or null to go ahead.
   */
  private async resolveOpenCheckouts(
    userId: Types.ObjectId,
    vendorId: Types.ObjectId,
    createDto: CreateOrderDto,
    orderData: CheckoutCalculation,
  ): PromisifiedOperationFeedback<OrderDocument> | null {
    const openOrders =
      await this.ordersRepository.findPendingPaymentOrdersForStore(
        userId,
        vendorId,
      );

    for (const order of openOrders) {
      const settlement = await this.settlePendingPaymentOrder(order);

      if (settlement === "paid") {
        return this.Result(
          true,
          "Your earlier checkout with this store has just been paid. Check your orders before ordering again.",
          undefined,
          409,
        );
      }
      if (settlement === "cancelled") {
        continue;
      }

      if (this.isSameCheckout(order, createDto, orderData)) {
        return this.Result(
          false,
          "You already have this order awaiting payment",
          order,
          200,
        );
      }

      // Could not check the old link with Kashia: leave it to expire rather
      // than cancel an order that may have been paid.
      if (settlement === "unknown") {
        continue;
      }

      await this.cancelPendingPaymentOrder(
        String(order._id as Types.ObjectId),
        "Replaced by a newer checkout",
        { paymentReference: order.paymentReference },
      );
    }

    return null;
  }

  /** Same lines, quantities, address, delivery method and total. */
  private isSameCheckout(
    order: OrderDocument,
    createDto: CreateOrderDto,
    orderData: CheckoutCalculation,
  ): boolean {
    const linesKey = (items: ICartItem[]) =>
      (items || [])
        .map(
          (item) =>
            `${String(item.productId)}:${item.variationId ? String(item.variationId) : ""}:${item.quantity}`,
        )
        .sort()
        .join("|");

    const shippingAddress = order.shippingAddress as {
      _id?: Types.ObjectId;
    } | null;

    return (
      linesKey(order.items as ICartItem[]) === linesKey(orderData.items) &&
      order.deliveryMethod === createDto.deliveryMethod &&
      String(shippingAddress?._id ?? "") === String(createDto.addressId) &&
      order.total === orderData.total
    );
  }

  /**
   * Asks Kashia where an unpaid order stands, confirming or cancelling it as
   * the payment link dictates.
   */
  private async settlePendingPaymentOrder(
    order: OrderDocument,
  ): Promise<PendingPaymentSettlement> {
    if (!order.paymentReference || !this.kashiaService.isConfigured()) {
      return "pending";
    }

    const result = await this.resolveOrderPaymentVerification(
      String(order._id as Types.ObjectId),
    );
    if (result.failed) {
      return "unknown";
    }

    switch (result.data?.paymentStatus) {
      case "confirmed":
      case "already_confirmed":
        return "paid";
      case "failed":
        return "cancelled";
      default:
        return "pending";
    }
  }

  /**
   * Frees stock held by unpaid orders that have outlived the hold window
   * (optionally only those holding `productIds`). Each is first checked with
   * Kashia: paid orders are confirmed, expired links cancelled, and orders
   * whose link is still open are left until the maximum hold has passed.
   *
   * @returns how many orders were cancelled (and their stock released).
   */
  async reclaimStaleStockHolds(
    productIds: string[] = [],
    options: { timeBudgetMs?: number } = {},
  ): Promise<number> {
    const { released } = await this.reclaimStaleHoldsBatch(
      productIds,
      STALE_HOLD_RECLAIM_LIMIT,
      new Set(),
      options.timeBudgetMs === undefined
        ? undefined
        : Date.now() + options.timeBudgetMs,
    );
    if (released > 0) {
      this.logger.log(
        `Released stock from ${released} unpaid order(s)${productIds.length ? ` for product(s) ${productIds.join(", ")}` : ""}`,
      );
    }
    return released;
  }

  /**
   * Works through every stale stock hold across all products, so stock held
   * by abandoned checkouts goes back on sale without waiting for a shopper
   * to run short of it (which add-to-cart's stock check would prevent).
   * Stops when no stale hold is left to check or `timeBudgetMs` has passed;
   * the next run carries on, since checked holds go to the back of the queue.
   */
  async sweepAbandonedCheckouts(
    options: { timeBudgetMs?: number } = {},
  ): Promise<AbandonedCheckoutSweepResult> {
    const startedAt = Date.now();
    const budget = options.timeBudgetMs ?? STALE_HOLD_SWEEP_BUDGET_MS;
    const seen = new Set<string>();
    const result: AbandonedCheckoutSweepResult = {
      examined: 0,
      released: 0,
      complete: false,
    };

    while (Date.now() - startedAt < budget) {
      const batch = await this.reclaimStaleHoldsBatch(
        [],
        STALE_HOLD_RECLAIM_LIMIT,
        seen,
      );
      result.examined += batch.examined;
      result.released += batch.released;
      if (batch.examined === 0) {
        result.complete = true;
        break;
      }
    }

    if (result.examined > 0) {
      this.logger.log(
        `Abandoned checkout sweep: examined ${result.examined}, released ${result.released}${result.complete ? "" : " (time budget reached; continuing next run)"}`,
      );
    }
    return result;
  }

  /**
   * Checks one batch of stale holds. Each examined order that is still
   * unpaid is marked as checked, whatever the outcome (link open, Kashia
   * unreachable, an error), so the next batch moves on to other orders.
   * Orders already in `seen` are not examined again in the same sweep.
   */
  private async reclaimStaleHoldsBatch(
    productIds: string[],
    limit: number,
    seen: Set<string> = new Set(),
    deadline?: number,
  ): Promise<{ examined: number; released: number }> {
    const now = Date.now();
    const candidates =
      await this.ordersRepository.findStalePendingPaymentOrders({
        createdBefore: new Date(now - PENDING_PAYMENT_HOLD_MS),
        checkedBefore: new Date(now - STALE_HOLD_RECHECK_MS),
        maxHoldBefore: new Date(now - PENDING_PAYMENT_MAX_HOLD_MS),
        limit,
        productIds: productIds.map((id) =>
          this.utilsService.objectIdFromString(id),
        ),
      });
    const idOf = (order: OrderDocument) =>
      (order._id as Types.ObjectId).toHexString();
    const staleOrders = candidates.filter((order) => !seen.has(idOf(order)));

    let released = 0;
    let examined = 0;
    for (const order of staleOrders) {
      if (deadline !== undefined && Date.now() >= deadline) {
        break; // A shopper is waiting; the sweep checks the rest.
      }
      examined++;
      seen.add(idOf(order));
      try {
        if (await this.reclaimStaleHold(order, now)) {
          released++;
        }
      } catch (error) {
        this.logger.error(
          `Failed to reclaim stock from unpaid order ${this.orderDisplayRef(order)}`,
          error,
        );
      } finally {
        await this.ordersRepository
          .markStockHoldChecked(order._id as Types.ObjectId, new Date(now))
          .catch((error) =>
            this.logger.error(
              `Failed to mark the hold of order ${this.orderDisplayRef(order)} as checked`,
              error,
            ),
          );
      }
    }

    return { examined, released };
  }

  /** @returns whether the order was cancelled and its stock released. */
  private async reclaimStaleHold(
    order: OrderDocument,
    now: number,
  ): Promise<boolean> {
    const settlement = await this.settlePendingPaymentOrder(order);
    if (settlement === "cancelled") {
      return true;
    }
    if (settlement !== "pending") {
      return false;
    }

    const hasOpenLink =
      !!order.paymentReference && this.kashiaService.isConfigured();
    const age = now - new Date(order.createdAt).getTime();
    if (hasOpenLink && age < PENDING_PAYMENT_MAX_HOLD_MS) {
      return false;
    }

    const cancellation = await this.cancelPendingPaymentOrder(
      String(order._id as Types.ObjectId),
      "Payment not completed in time",
      { paymentReference: order.paymentReference },
    );
    return cancellation.description === "Pending payment order cancelled";
  }

  /**
   * Promotes a paid order out of PENDING_PAYMENT. This is the only place stock is
   * committed, the cart is cleared, and confirmations are sent — in Phase 2 it is
   * driven by Kashia's `escrow.active` webhook rather than by the client.
   *
   * Idempotent and race-safe: the transition is a single conditional update, so
   * the webhook and the shopper's return-page poll cannot both confirm.
   */
  async confirmOrderPayment(
    orderId: string,
    escrow?: OrderPaymentConfirmation,
  ): PromisifiedOperationFeedback<OrderDocument> {
    const objectOrderId = this.utilsService.objectIdFromString(orderId);
    const order = await this.ordersRepository.query({ _id: objectOrderId });

    if (!order) {
      return this.Result(true, "Order not found", undefined, 404);
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return this.settledPaymentResult(order, escrow);
    }

    if (escrow?.amountKobo !== undefined) {
      const expectedKobo = nairaToKobo(order.total);
      if (escrow.amountKobo !== expectedKobo) {
        this.logger.warn(
          `Kashia reports ${escrow.amountKobo} kobo for order ${this.orderDisplayRef(order)} but the order total is ${expectedKobo} kobo; confirming as reported`,
        );
      }
    }

    const updatedOrder = await this.applyStatusTransition(
      order,
      OrderStatus.PENDING,
      "Payment confirmed",
      {
        set: this.escrowFieldsToSet(escrow),
        // Checked in the same update: Kashia's report that it returned this
        // money may land while the confirmation is under way.
        filter: escrow?.escrowId
          ? { providerRefundedEscrowIds: { $ne: escrow.escrowId } }
          : {},
      },
    );

    if (!updatedOrder) {
      // Another caller moved the order first (a concurrent confirmation, or a
      // cancellation that landed before the payment did), or Kashia returned
      // the money in the meantime.
      const current = await this.ordersRepository.query({ _id: objectOrderId });
      if (
        current?.status === OrderStatus.PENDING_PAYMENT &&
        this.wasReturnedByProvider(current, escrow?.escrowId)
      ) {
        return this.cancelForReturnedPayment(current);
      }
      return this.settledPaymentResult(current ?? order, escrow);
    }

    await this.cartsService.clearCart(String(order.userId));

    // Awaited on purpose: the webhook response waits for this, and on Lambda
    // nothing runs once the response is sent. Failures are logged inside.
    await this.dispatchOrderCreatedEmails(updatedOrder);

    return this.Result(false, "Payment confirmed", updatedOrder);
  }

  private wasReturnedByProvider(
    order: { providerRefundedEscrowIds?: string[] },
    escrowId?: string,
  ): boolean {
    return (
      !!escrowId && (order.providerRefundedEscrowIds || []).includes(escrowId)
    );
  }

  /**
   * Kashia reported the payment refunded before the order was confirmed
   * (its events can arrive out of order). The money is back with the
   * shopper, so the order is cancelled instead of sent to the store.
   */
  private async cancelForReturnedPayment(
    order: OrderDocument,
  ): PromisifiedOperationFeedback<OrderDocument> {
    const cancelled = await this.applyStatusTransition(
      order,
      OrderStatus.CANCELLED,
      "Payment was returned to the shopper before the order was confirmed",
    );
    if (cancelled) {
      this.logger.warn(
        `Order ${this.orderDisplayRef(order)} cancelled: Kashia returned the payment before it was confirmed`,
      );
      // Awaited: this runs from the webhook, and on Lambda nothing runs
      // once the response is sent. Failures are logged inside.
      await this.dispatchOrderStatusEmail(
        cancelled,
        OrderStatus.CANCELLED,
        "Your payment was returned to you, so this order was cancelled.",
      );
    }
    const current =
      cancelled ??
      (await this.ordersRepository.query({ _id: order._id })) ??
      order;
    return this.Result(
      true,
      "Payment was returned to the shopper before the order was confirmed",
      current,
      409,
    );
  }

  /**
   * Result for a confirmation that arrives after the order already left
   * PENDING_PAYMENT. Money captured that the order cannot keep (a payment on
   * a cancelled order, or a second payment) is recorded on the order as a
   * refund owed to the shopper.
   */
  private async settledPaymentResult(
    order: OrderDocument,
    escrow?: OrderPaymentConfirmation,
  ): PromisifiedOperationFeedback<OrderDocument> {
    if (order.status !== OrderStatus.CANCELLED) {
      if (escrow?.escrowId && escrow.escrowId !== order.escrowId) {
        const isOrdersOwnPayment =
          !order.escrowId &&
          (!escrow.paymentReference ||
            escrow.paymentReference === order.paymentReference);

        if (isOrdersOwnPayment) {
          // Confirmed earlier from the payment link, which lacked the escrow
          // id: this is the same payment, so record its escrow.
          await this.updateOrderEscrowFields(
            (order._id as Types.ObjectId).toHexString(),
            { escrowId: escrow.escrowId },
            { onlyIfNoEscrowId: true },
          );
        } else {
          // A second, different payment for an order that is already paid:
          // the shopper paid twice (e.g. two payment links). Keep the first.
          this.logger.error(
            `Second payment captured for order ${this.orderDisplayRef(order)} (escrow=${escrow.escrowId}, reference=${escrow.paymentReference ?? "n/a"}; order already paid with escrow=${order.escrowId ?? "n/a"}, reference=${order.paymentReference ?? "n/a"}); manual refund required`,
          );
          await this.openRefund(order, OrderRefundReason.DUPLICATE_PAYMENT, {
            ...escrow,
            escrowId: escrow.escrowId,
          });
        }
      }
      return this.Result(false, "Payment already confirmed", order, 200);
    }

    if (escrow?.escrowId) {
      this.logger.error(
        `Payment captured for cancelled order ${this.orderDisplayRef(order)} (escrow=${escrow.escrowId}, reference=${escrow.paymentReference ?? order.paymentReference ?? "n/a"}); manual refund required`,
      );
      // Recorded as the order's escrow only if it has none: a cancelled paid
      // order keeps the escrow it was paid with. The late payment is tracked
      // by its refund either way.
      await this.updateOrderEscrowFields(
        (order._id as Types.ObjectId).toHexString(),
        escrow,
        { onlyIfNoEscrowId: true },
      );
      await this.openRefund(order, OrderRefundReason.PAID_AFTER_CANCELLATION, {
        ...escrow,
        escrowId: escrow.escrowId,
      });
    }

    return this.Result(
      true,
      "Order was cancelled before payment was captured",
      order,
      409,
    );
  }

  /**
   * Records that the money in `escrow` must go back to the shopper. Safe to
   * call again for the same escrow (e.g. a redelivered webhook).
   */
  private async openRefund(
    order: OrderDocument,
    reason: OrderRefundReason,
    escrow: OrderPaymentConfirmation & { escrowId: string },
  ): Promise<void> {
    const orderId = order._id as Types.ObjectId;
    await this.ordersRepository.addRefund(
      orderId,
      this.withoutUndefined({
        reason,
        amount:
          escrow.amountKobo !== undefined
            ? koboToNaira(escrow.amountKobo)
            : order.total,
        escrowId: escrow.escrowId,
        paymentReference: escrow.paymentReference ?? order.paymentReference,
      }),
    );
    // Kashia's refund report may have been handled before this payment
    // report (deliveries can arrive out of order).
    await this.ordersRepository.completeRefundFromProvider(
      orderId,
      { escrowId: escrow.escrowId },
      { onlyIfProviderRefunded: escrow.escrowId },
    );
  }

  /**
   * Kashia reports that it returned the money in an escrow.
   *
   * The escrow is remembered on the order first, then any refund owed for it
   * is closed. Whoever opens a refund checks that record right after opening
   * it, so whichever of the two lands first, the refund ends up closed and is
   * never left to be paid again by hand.
   */
  async recordEscrowRefunded(
    orderId: string,
    event: EscrowRefundedEvent,
  ): Promise<EscrowRefundedOutcome> {
    const objectOrderId = this.utilsService.objectIdFromString(orderId);

    if (event.escrowId) {
      await this.ordersRepository.markEscrowRefundedByProvider(
        objectOrderId,
        event.escrowId,
      );
      const closed = await this.ordersRepository.completeRefundFromProvider(
        objectOrderId,
        { escrowId: event.escrowId },
      );
      if (closed) return "completed";
    }

    if (event.paymentReference) {
      const closed = await this.ordersRepository.completeRefundFromProvider(
        objectOrderId,
        { escrowId: null, paymentReference: event.paymentReference },
        { attachEscrowId: event.escrowId },
      );
      if (closed) return "completed";
    }

    return this.recordProviderRefundOfManualRefund(objectOrderId, event);
  }

  /**
   * Kashia refunded an escrow whose refund an admin had already completed by
   * hand. Through Kashia that is the expected confirmation; by any other
   * method the shopper has likely been paid twice, which is flagged.
   */
  private async recordProviderRefundOfManualRefund(
    orderId: Types.ObjectId,
    event: EscrowRefundedEvent,
  ): Promise<EscrowRefundedOutcome> {
    const order = await this.ordersRepository.query({ _id: orderId });
    const refund = (order?.refunds || []).find((entry) => {
      const sameEscrow = !!event.escrowId && entry.escrowId === event.escrowId;
      // A refund opened before the escrow id was known.
      const samePayment =
        !entry.escrowId &&
        !!event.paymentReference &&
        entry.paymentReference === event.paymentReference;
      return (
        entry.status === OrderRefundStatus.REFUNDED &&
        entry.resolvedBy === OrderRefundResolution.ADMIN &&
        !entry.providerConfirmedAt &&
        (sameEscrow || samePayment)
      );
    });
    if (!refund?.payout) {
      return "unmatched";
    }

    const possibleDoubleRefund =
      refund.payout.method !== OrderRefundPayoutMethod.KASHIA;
    const recorded =
      await this.ordersRepository.recordProviderRefundOfManualRefund(
        orderId,
        { _id: refund._id },
        refund.payout.method,
        possibleDoubleRefund,
      );
    if (!recorded) {
      // Reopened or confirmed concurrently; nothing reliable to flag.
      return "unmatched";
    }

    if (possibleDoubleRefund) {
      this.logger.error(
        `Possible double refund on order ${this.orderDisplayRef(order)}: Kashia refunded escrow ${event.escrowId ?? "n/a"} (reference=${event.paymentReference ?? "n/a"}) but refund ${String(refund._id)} was already paid by ${refund.payout.method} (payout reference ${refund.payout.reference}); recover the duplicate from the shopper`,
      );
      return "possible_double_refund";
    }
    return "confirmed";
  }

  /**
   * Applies a Kashia escrow lifecycle event to the order it belongs to, so
   * the order follows where its money actually is:
   *
   * - refunded: a paid order not yet shipped is cancelled (Kashia already
   *   returned the money, so its refund closes at once); an unpaid order is
   *   cancelled rather than later confirmed.
   * - cancelled: a paid order not yet shipped is cancelled too, but whether
   *   the shopper got the money back is unknown, so its refund stays owed and
   *   an alert asks an admin to check with Kashia.
   * - completed: a shipped order is delivered (the money went to the store).
   * - money returned after shipping, released for an order that was not
   *   fulfilled, released early, or disputed: an alert for an admin.
   *
   * Only events for the order's own escrow change the order's escrow fields
   * or status; events for another escrow (e.g. a duplicate payment) can only
   * raise an alert. Stale events (older than the status already applied, or
   * a non-final status after a final one) are ignored. Safe to redeliver.
   *
   * @returns a short outcome for the webhook record.
   * @throws if the order kept changing underneath, so the delivery is retried.
   */
  async handleEscrowEvent(
    orderId: string,
    event: OrderEscrowEvent,
  ): Promise<string> {
    const objectOrderId = this.utilsService.objectIdFromString(orderId);

    for (let attempt = 0; attempt < ESCROW_EVENT_MAX_ATTEMPTS; attempt++) {
      const order = await this.ordersRepository.query({ _id: objectOrderId });
      if (!order) {
        return "order not found";
      }

      const outcome = (await this.isOrdersOwnEscrow(order, event))
        ? await this.applyOwnEscrowEvent(order, event)
        : await this.applyOtherEscrowEvent(order, event);
      if (outcome !== ESCROW_EVENT_RETRY) {
        return outcome;
      }
    }

    throw new Error(
      `Order ${orderId} kept changing while applying escrow.${event.event}; will retry on redelivery`,
    );
  }

  /**
   * Whether `event` is about the escrow that paid for this order. An order
   * confirmed from its payment link may not know its escrow id yet; it takes
   * it from an event paid through its own link.
   */
  private async isOrdersOwnEscrow(
    order: OrderDocument,
    event: OrderEscrowEvent,
  ): Promise<boolean> {
    const throughOwnLink =
      !!event.paymentReference &&
      event.paymentReference === order.paymentReference;

    if (!event.escrowId) {
      return throughOwnLink;
    }
    if (order.escrowId) {
      return order.escrowId === event.escrowId;
    }
    if (!throughOwnLink) {
      return false;
    }

    await this.ordersRepository.adoptEscrow(
      order._id as Types.ObjectId,
      event.escrowId,
      event.paymentReference,
    );
    // Re-read: adopted by this call or a concurrent one, or not at all.
    const current = await this.ordersRepository.query({ _id: order._id });
    if (current?.escrowId === event.escrowId) {
      order.escrowId = event.escrowId;
      return true;
    }
    return false;
  }

  private async applyOwnEscrowEvent(
    order: OrderDocument,
    event: OrderEscrowEvent,
  ): Promise<string> {
    const escrowStatus = event.escrowStatus ?? event.event;

    if (event.escrowId) {
      const current = await this.ordersRepository.mirrorEscrowStatus(
        order._id as Types.ObjectId,
        event.escrowId,
        escrowStatus,
        event.occurredAt,
      );
      if (!current) {
        return `stale escrow.${event.event} ignored (order escrow status is ${order.escrowStatus ?? "n/a"})`;
      }
    }

    const status = order.status;
    switch (event.event) {
      case EscrowLifecycleEvent.REFUNDED:
        if (status === OrderStatus.PENDING_PAYMENT) {
          const result = await this.cancelForReturnedPayment(order);
          return result.data?.status === OrderStatus.CANCELLED
            ? "unpaid order cancelled: payment returned"
            : ESCROW_EVENT_RETRY;
        }
        if (PAID_UNSHIPPED_ORDER_STATUSES.includes(status)) {
          return this.stopFulfilment(
            order,
            "Kashia returned the payment to the shopper",
            "Your payment was returned to you, so this order was cancelled.",
          );
        }
        if (SHIPPED_ORDER_STATUSES.includes(status)) {
          return this.raisePaymentAlert(order, {
            type: OrderPaymentAlertType.ESCROW_REVERSED_AFTER_SHIPPING,
            escrowId: event.escrowId,
            message: `Kashia refunded the shopper after the order was ${status.toLowerCase()}. The store sent the goods but will not be paid from this escrow.`,
          });
        }
        return "escrow status mirrored: refunded";

      case EscrowLifecycleEvent.CANCELLED:
        if (status === OrderStatus.PENDING_PAYMENT) {
          return "escrow status mirrored: cancelled (order unpaid)";
        }
        if (PAID_UNSHIPPED_ORDER_STATUSES.includes(status)) {
          const stopped = await this.stopFulfilment(
            order,
            "Kashia cancelled the payment",
            "There was a problem with your payment, so this order was cancelled. We'll make sure any money taken is returned to you.",
          );
          if (stopped === ESCROW_EVENT_RETRY) return stopped;
          await this.raiseEscrowCancelledAlert(order, event);
          return `${stopped}; refund check raised`;
        }
        if (SHIPPED_ORDER_STATUSES.includes(status)) {
          return this.raisePaymentAlert(order, {
            type: OrderPaymentAlertType.ESCROW_REVERSED_AFTER_SHIPPING,
            escrowId: event.escrowId,
            message: `Kashia cancelled the payment after the order was ${status.toLowerCase()}. The store sent the goods; check with Kashia where the money is.`,
          });
        }
        if (this.hasOutstandingRefund(order, event.escrowId)) {
          return this.raiseEscrowCancelledAlert(order, event);
        }
        return "escrow status mirrored: cancelled";

      case EscrowLifecycleEvent.COMPLETED:
        if (status === OrderStatus.SHIPPED) {
          return this.completeFromEscrow(order);
        }
        if (status === OrderStatus.DELIVERED) {
          return "escrow status mirrored: completed";
        }
        if (UNFULFILLED_ORDER_STATUSES.includes(status)) {
          return this.raisePaymentAlert(order, {
            type: OrderPaymentAlertType.ESCROW_RELEASED_FOR_CANCELLED_ORDER,
            escrowId: event.escrowId,
            message: `Kashia released the payment to the store, but the order was ${status.toLowerCase()}. Any refund owed to the shopper has to be recovered from the store.`,
          });
        }
        return this.raisePaymentAlert(order, {
          type: OrderPaymentAlertType.ESCROW_RELEASED_BEFORE_SHIPPING,
          escrowId: event.escrowId,
          message: `Kashia released the payment to the store while the order was ${status.toLowerCase()} (not yet shipped).`,
        });

      case EscrowLifecycleEvent.DISPUTED:
        return this.raisePaymentAlert(order, {
          type: OrderPaymentAlertType.ESCROW_DISPUTED,
          escrowId: event.escrowId,
          message: `The shopper disputed the payment on Kashia while the order was ${status.toLowerCase()}.`,
        });

      default:
        return `escrow status mirrored: ${escrowStatus}`;
    }
  }

  /**
   * An escrow that is not the order's own (a duplicate payment, or an old
   * payment link). It never changes the order; money reaching the store or a
   * dispute is flagged. Its refund, if any, is tracked by the order's refunds.
   */
  private async applyOtherEscrowEvent(
    order: OrderDocument,
    event: OrderEscrowEvent,
  ): Promise<string> {
    switch (event.event) {
      case EscrowLifecycleEvent.COMPLETED:
        return this.raisePaymentAlert(order, {
          type: OrderPaymentAlertType.OTHER_ESCROW_RELEASED,
          escrowId: event.escrowId,
          message: `Kashia released a payment (escrow ${event.escrowId ?? "n/a"}) that is not this order's payment to the store. The shopper paid more than once; the extra money has to be recovered from the store.`,
        });
      case EscrowLifecycleEvent.DISPUTED:
        return this.raisePaymentAlert(order, {
          type: OrderPaymentAlertType.ESCROW_DISPUTED,
          escrowId: event.escrowId,
          message: `The shopper disputed a payment (escrow ${event.escrowId ?? "n/a"}) that is not this order's payment.`,
        });
      default:
        return `escrow.${event.event} is not for the order's escrow; order unchanged`;
    }
  }

  /** Cancels a paid order the store has not shipped, because its money went back. */
  private async stopFulfilment(
    order: OrderDocument,
    description: string,
    shopperNote: string,
  ): Promise<string> {
    const cancelled = await this.applyStatusTransition(
      order,
      OrderStatus.CANCELLED,
      description,
    );
    if (!cancelled) {
      return ESCROW_EVENT_RETRY;
    }
    this.logger.warn(
      `Order ${this.orderDisplayRef(order)} cancelled from ${order.status}: ${description}`,
    );
    // Awaited: this runs from the webhook (see confirmOrderPayment).
    await this.dispatchOrderStatusEmail(
      cancelled,
      OrderStatus.CANCELLED,
      shopperNote,
    );
    return `order cancelled from ${order.status}: ${description}`;
  }

  /** The money was released to the store for a shipped order: it arrived. */
  private async completeFromEscrow(order: OrderDocument): Promise<string> {
    const delivered = await this.applyStatusTransition(
      order,
      OrderStatus.DELIVERED,
      "Completed on Kashia: payment released to the store",
    );
    if (!delivered) {
      return ESCROW_EVENT_RETRY;
    }
    await this.dispatchOrderStatusEmail(delivered, OrderStatus.DELIVERED);
    return "order delivered: escrow completed";
  }

  private hasOutstandingRefund(order: OrderDocument, escrowId?: string) {
    return (order.refunds || []).some(
      (refund) =>
        refund.status === OrderRefundStatus.REQUIRED &&
        (!escrowId || refund.escrowId === escrowId),
    );
  }

  private raiseEscrowCancelledAlert(
    order: OrderDocument,
    event: OrderEscrowEvent,
  ): Promise<string> {
    return this.raisePaymentAlert(order, {
      type: OrderPaymentAlertType.ESCROW_CANCELLED_AFTER_PAYMENT,
      escrowId: event.escrowId,
      message:
        "Kashia cancelled a payment that had been made. Check with Kashia whether the shopper was refunded before refunding them yourself.",
    });
  }

  private async raisePaymentAlert(
    order: OrderDocument,
    alert: Pick<IOrderPaymentAlert, "type" | "escrowId" | "message">,
  ): Promise<string> {
    const raised = await this.ordersRepository.addPaymentAlert(
      order._id as Types.ObjectId,
      { ...this.withoutUndefined(alert), orderStatus: order.status },
    );
    if (raised) {
      this.logger.error(
        `Payment alert on order ${this.orderDisplayRef(order)} (${alert.type}, escrow=${alert.escrowId ?? "n/a"}): ${alert.message}`,
      );
    }
    return `alert ${alert.type}${raised ? " raised" : " already raised"}`;
  }

  /** Admin records how a payment alert was dealt with. */
  async resolvePaymentAlert(
    orderId: string,
    alertId: string,
    adminId: string,
    note: string,
  ): PromisifiedOperationFeedback<OrderDocument> {
    const objectOrderId = this.utilsService.objectIdFromString(orderId);
    const resolved = await this.ordersRepository.resolvePaymentAlert(
      objectOrderId,
      this.utilsService.objectIdFromString(alertId),
      { adminId, note: note.trim() },
    );
    if (resolved) {
      this.logger.log(
        `Payment alert ${alertId} on order ${this.orderDisplayRef(resolved)} resolved by admin ${adminId}`,
      );
      return this.Result(false, "Alert resolved", resolved);
    }

    const order = await this.ordersRepository.query({ _id: objectOrderId });
    if (!order) {
      return this.Result(true, "Order not found", undefined, 404);
    }
    const alert = (order.paymentAlerts || []).find(
      (entry) => String(entry._id) === alertId,
    );
    if (!alert) {
      return this.Result(true, "Alert not found on this order", undefined, 404);
    }
    return this.Result(
      true,
      "This alert has already been resolved",
      undefined,
      409,
    );
  }

  /**
   * An admin records a refund they made by hand (most refunds: the payment
   * provider may not be able to refund). Requires evidence, and the amount
   * typed again so the right refund is being closed. A payout reference can
   * back only one refund. The shopper is told, with the reference, and can
   * report the money missing.
   */
  async completeOrderRefund(
    orderId: string,
    refundId: string,
    adminId: string,
    evidence: ManualRefundEvidence,
  ): PromisifiedOperationFeedback<OrderDocument> {
    const objectOrderId = this.utilsService.objectIdFromString(orderId);
    const objectRefundId = this.utilsService.objectIdFromString(refundId);

    const order = await this.ordersRepository.query({ _id: objectOrderId });
    if (!order) {
      return this.Result(true, "Order not found", undefined, 404);
    }
    const refund = this.findRefund(order, refundId);
    if (!refund) {
      return this.Result(
        true,
        "Refund not found on this order",
        undefined,
        404,
      );
    }
    if (refund.status !== OrderRefundStatus.REQUIRED) {
      return this.refundAlreadyCompletedResult();
    }
    if (nairaToKobo(evidence.amount) !== nairaToKobo(refund.amount)) {
      return this.Result(
        true,
        `The amount entered does not match this refund (${refund.amount}). Check you are closing the right refund.`,
        undefined,
        400,
      );
    }

    const reference = evidence.reference.trim();
    const referenceKey = normalizePayoutReference(reference);
    if (!referenceKey) {
      return this.Result(
        true,
        "A payout reference is required",
        undefined,
        400,
      );
    }

    // Reserve the reference first: the unique index guarantees one payout
    // backs one refund, even when two admins submit at once.
    const completionId = new Types.ObjectId();
    const claimed = await this.refundPayoutReferences.claim(
      referenceKey,
      objectOrderId,
      objectRefundId,
      completionId,
    );
    if (!claimed) {
      return this.Result(
        true,
        "This payout reference is already recorded against another refund. Check the reference.",
        undefined,
        409,
      );
    }

    const note = evidence.note?.trim() || undefined;
    const updated = await this.ordersRepository.completeRefundManually(
      objectOrderId,
      objectRefundId,
      {
        completionId,
        adminId,
        payout: {
          method: evidence.method,
          reference,
          referenceKey,
          amount: refund.amount,
        },
        note,
      },
    );
    if (!updated) {
      // Completed by someone else (another admin, or Kashia) in the meantime.
      await this.refundPayoutReferences.release(
        referenceKey,
        objectOrderId,
        objectRefundId,
        completionId,
      );
      return this.refundAlreadyCompletedResult();
    }

    this.logger.log(
      `Refund ${refundId} on order ${this.orderDisplayRef(updated)} completed by admin ${adminId} via ${evidence.method} (reference ${reference})`,
    );
    const completed = this.findRefund(updated, refundId);
    if (completed) {
      await this.dispatchRefundSentEmail(updated, completed);
    }
    return this.Result(false, "Refund marked as completed", updated);
  }

  /**
   * Admin puts a refund completed by hand back in the queue, e.g. it was
   * marked by mistake. The completion stays in the refund's history.
   */
  async reopenOrderRefund(
    orderId: string,
    refundId: string,
    adminId: string,
    reason: string,
  ): PromisifiedOperationFeedback<OrderDocument> {
    return this.reopenRefund(orderId, refundId, {
      actor: OrderRefundActor.ADMIN,
      actorId: adminId,
      reason: reason.trim(),
    });
  }

  /**
   * The shopper says a refund marked as sent never arrived. It goes back in
   * the admin queue, with the earlier payout in its history, so an admin
   * checks the payout before paying again.
   */
  async reportRefundNotReceived(
    userId: string,
    orderId: string,
    refundId: string,
  ): PromisifiedOperationFeedback<OrderDocument> {
    const result = await this.reopenRefund(orderId, refundId, {
      actor: OrderRefundActor.SHOPPER,
      actorId: userId,
      reason: "Shopper reported the refund was not received",
      orderFilter: { userId: this.utilsService.objectIdFromString(userId) },
      refundedSince: new Date(Date.now() - REFUND_NOT_RECEIVED_WINDOW_MS),
    });
    if (!result.failed) {
      this.logger.warn(
        `Shopper ${userId} reported refund ${refundId} on order ${this.orderDisplayRef(result.data)} as not received; back in the refund queue`,
      );
    }
    return result;
  }

  private async reopenRefund(
    orderId: string,
    refundId: string,
    reopen: {
      actor: OrderRefundActor;
      actorId: string;
      reason: string;
      orderFilter?: Record<string, unknown>;
      refundedSince?: Date;
    },
  ): PromisifiedOperationFeedback<OrderDocument> {
    const objectOrderId = this.utilsService.objectIdFromString(orderId);
    const objectRefundId = this.utilsService.objectIdFromString(refundId);

    // Read before reopening: the payout reference has to be freed, and the
    // reopen clears it from the refund.
    const before = await this.ordersRepository.query({
      ...reopen.orderFilter,
      _id: objectOrderId,
    });
    const refundBefore = before ? this.findRefund(before, refundId) : undefined;

    const updated = await this.ordersRepository.reopenRefund(
      objectOrderId,
      objectRefundId,
      { ...reopen, completionId: refundBefore?.completionId },
    );
    if (updated) {
      // Frees the reference only if that completion still holds it, so if the
      // refund is recorded again with it meanwhile, the new claim stands.
      if (refundBefore?.payout?.referenceKey && refundBefore.completionId) {
        await this.refundPayoutReferences.release(
          refundBefore.payout.referenceKey,
          objectOrderId,
          objectRefundId,
          refundBefore.completionId,
        );
      }
      return this.Result(false, "Refund reopened", updated);
    }

    // Work out why, from the current state.
    const order = await this.ordersRepository.query({
      ...reopen.orderFilter,
      _id: objectOrderId,
    });
    if (!order) {
      return this.Result(true, "Order not found", undefined, 404);
    }
    const refund = this.findRefund(order, refundId);
    if (!refund) {
      return this.Result(
        true,
        "Refund not found on this order",
        undefined,
        404,
      );
    }
    if (refund.status === OrderRefundStatus.REQUIRED) {
      return this.Result(
        true,
        "This refund is still in progress",
        undefined,
        409,
      );
    }
    if (
      refund.resolvedBy === OrderRefundResolution.KASHIA ||
      refund.providerConfirmedAt
    ) {
      return this.Result(
        true,
        "Kashia confirmed this refund was returned, so it cannot be reopened. Contact support with the Kashia reference.",
        undefined,
        409,
      );
    }
    return this.Result(
      true,
      "This refund can no longer be reported here. Please contact support.",
      undefined,
      409,
    );
  }

  private findRefund(
    order: { refunds?: IOrderRefund[] },
    refundId: string,
  ): IOrderRefund | undefined {
    return (order.refunds || []).find(
      (entry) => String(entry._id) === refundId,
    );
  }

  private refundAlreadyCompletedResult(): OperationFeedback<OrderDocument> {
    return this.Result<OrderDocument>(
      true,
      "This refund has already been marked as completed",
      undefined,
      409,
    );
  }

  /**
   * Moves `order` from the status it was read in to `status` with a single
   * conditional update, so only one of several concurrent callers (shopper,
   * store, admin, payment webhook) can make the change. Only that caller
   * returns stock, which is released after the status change so a racing
   * payment can never be confirmed against stock already put back on sale.
   *
   * @returns the updated order, or null if the order changed in the meantime.
   */
  private async applyStatusTransition(
    order: OrderDocument,
    status: OrderStatus,
    description: string,
    options: OrderTransitionOptions = {},
  ): Promise<OrderDocument | null> {
    const releasesStock = STOCK_RELEASING_ORDER_STATUSES.includes(status);
    const capturesPayment =
      order.status === OrderStatus.PENDING_PAYMENT &&
      status === OrderStatus.PENDING;
    // Opened in the same update as the status change, so exactly one caller
    // records it even when several race to cancel.
    const refund = releasesStock
      ? this.refundForCancelledOrder(order, status)
      : null;

    // The status change and the stock it releases are one transaction: a
    // crash between them must not leave an order that no longer holds stock
    // whose stock was never returned.
    const previous = await this.transactions.run(async (session) => {
      const before = await this.ordersRepository.transitionStatus(
        order._id as Types.ObjectId,
        order.status,
        {
          $set: {
            status,
            ...(releasesStock && {
              stockReserved: false,
              stockCommitted: false,
            }),
            // Reserved stock becomes committed stock once paid.
            ...(capturesPayment && {
              stockReserved: false,
              stockCommitted: true,
            }),
            ...options.set,
          },
          $push: {
            timeline: { status, description, date: new Date() },
            ...(refund && { refunds: newRefundRecord(refund) }),
          },
        },
        false,
        {
          // The refund names the escrow read above; if the order's payment
          // changed since, refuse rather than refund the wrong escrow.
          ...(refund && {
            escrowId: order.escrowId ?? null,
            paymentReference: order.paymentReference ?? null,
          }),
          ...options.filter,
        },
        session,
      );
      if (
        before &&
        releasesStock &&
        (before.stockReserved || before.stockCommitted)
      ) {
        await this.releaseStockForItems(
          (before.items || []) as ICartItem[],
          session,
        );
      }
      return before;
    });

    if (!previous) {
      return null;
    }

    if (refund?.escrowId) {
      // Kashia may already have returned this money (its report can arrive
      // before the cancellation); if so, close the refund rather than leave
      // it to be paid again by hand.
      await this.ordersRepository.completeRefundFromProvider(
        previous._id as Types.ObjectId,
        { escrowId: refund.escrowId },
        { onlyIfProviderRefunded: refund.escrowId },
      );
    }

    if (refund) {
      this.logger.warn(
        `Paid order ${this.orderDisplayRef(previous)} moved to ${status} (escrow=${previous.escrowId ?? "n/a"}, reference=${previous.paymentReference ?? "n/a"}); refund required, recorded on the order`,
      );
    } else if (
      releasesStock &&
      previous.status !== OrderStatus.PENDING_PAYMENT
    ) {
      this.logger.warn(
        `Order ${this.orderDisplayRef(previous)} moved from ${previous.status} to ${status} with no payment on record; check manually whether a refund is due`,
      );
    }

    return this.ordersRepository.query({ _id: previous._id });
  }

  /**
   * The refund owed when `order` is cancelled or declined, or null if it was
   * never paid. An order past PENDING_PAYMENT with a Kashia payment attached
   * has been paid; orders without one predate payments and took no money.
   */
  private refundForCancelledOrder(
    order: OrderDocument,
    status: OrderStatus,
  ): NewOrderRefund | null {
    if (order.status === OrderStatus.PENDING_PAYMENT) {
      return null;
    }
    if (!order.escrowId && !order.paymentReference) {
      return null;
    }

    return this.withoutUndefined({
      reason:
        status === OrderStatus.REJECTED
          ? OrderRefundReason.ORDER_REJECTED
          : OrderRefundReason.ORDER_CANCELLED,
      amount: order.total,
      escrowId: order.escrowId,
      paymentReference: order.paymentReference,
    });
  }

  private withoutUndefined<T extends object>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined),
    ) as T;
  }

  /** Response when an order changed between being read and being updated. */
  private async concurrentUpdateResult(
    orderId: Types.ObjectId,
  ): PromisifiedOperationFeedback<OrderDocument> {
    const current = await this.ordersRepository.query({ _id: orderId });
    return this.Result(
      true,
      `This order was just updated${current ? ` (now ${current.status})` : ""}. Please refresh and try again.`,
      undefined,
      409,
    );
  }

  private escrowFieldsToSet(
    fields?: OrderEscrowFields,
  ): Partial<OrderEscrowFields> {
    return {
      ...(fields?.escrowId ? { escrowId: fields.escrowId } : {}),
      ...(fields?.escrowStatus ? { escrowStatus: fields.escrowStatus } : {}),
      ...(fields?.paymentReference
        ? { paymentReference: fields.paymentReference }
        : {}),
    };
  }

  /**
   * After Kashia redirects the shopper back, poll Kashia for the payment link
   * status and confirm the order if paid. Idempotent — safe if the webhook
   * already ran first.
   */
  async verifyOrderPayment(
    userId: string,
    orderId: string,
  ): PromisifiedOperationFeedback<
    OrderDocument & OrderPaymentVerificationResult
  > {
    return this.resolveOrderPaymentVerification(orderId, userId);
  }

  /** Public Kashia return handler — no login required; returns minimal order info. */
  async verifyOrderPaymentPublic(
    orderId: string,
  ): PromisifiedOperationFeedback<PaymentReturnSummary> {
    const result = await this.resolveOrderPaymentVerification(orderId);
    if (result.failed) {
      return this.Result(
        true,
        result.description,
        undefined,
        result.code ?? 500,
      );
    }

    return this.Result(
      false,
      result.description,
      this.toPaymentReturnSummary(result.data!),
    );
  }

  private async resolveOrderPaymentVerification(
    orderId: string,
    userId?: string,
  ): PromisifiedOperationFeedback<
    OrderDocument & OrderPaymentVerificationResult
  > {
    const objectOrderId = this.utilsService.objectIdFromString(orderId);
    const query: Record<string, unknown> = { _id: objectOrderId };

    if (userId) {
      query.userId = this.utilsService.objectIdFromString(userId);
    }

    const order = await this.ordersRepository.query(query);

    if (!order) {
      return this.Result(true, "Order not found", undefined, 404);
    }

    if (order.status === OrderStatus.CANCELLED) {
      // Cancelled while unpaid (link expired, replaced or timed out). Not a
      // confirmed payment, even though the order has left PENDING_PAYMENT.
      return this.Result(
        false,
        "Order was cancelled",
        this.withVerificationResult(order, "failed"),
      );
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return this.Result(
        false,
        "Payment already confirmed",
        this.withVerificationResult(order, "already_confirmed"),
      );
    }

    if (!order.paymentReference) {
      return this.Result(
        true,
        "This order has no Kashia payment reference",
        undefined,
        400,
      );
    }

    if (!this.kashiaService.isConfigured()) {
      return this.Result(
        true,
        "Payment verification is not available",
        undefined,
        503,
      );
    }

    let paymentLink;
    try {
      paymentLink = await this.kashiaService.getPaymentLink(
        order.paymentReference,
      );
    } catch (error) {
      this.logger.error(
        `Kashia payment link lookup failed for order ${orderId}`,
        error,
      );
      return this.Result(
        true,
        "Unable to verify payment with Kashia",
        undefined,
        502,
      );
    }

    const linkStatus = paymentLink.status?.toLowerCase();

    if (isKashiaPaymentLinkPaid(linkStatus)) {
      const confirmation = await this.confirmOrderPayment(orderId, {
        escrowId: paymentLink.escrow_id,
        escrowStatus: paymentLink.escrow_status ?? "active",
        paymentReference: paymentLink.reference,
      });

      if (confirmation.failed && confirmation.code !== 200) {
        return this.Result(
          true,
          confirmation.description,
          undefined,
          confirmation.code ?? 500,
        );
      }

      const confirmedOrder = confirmation.data!;
      const paymentStatus: OrderPaymentVerificationStatus =
        confirmation.description === "Payment already confirmed"
          ? "already_confirmed"
          : "confirmed";

      return this.Result(
        false,
        paymentStatus === "confirmed"
          ? "Payment confirmed"
          : "Payment already confirmed",
        this.withVerificationResult(
          confirmedOrder,
          paymentStatus,
          paymentLink.status,
        ),
      );
    }

    if (isKashiaPaymentLinkFailed(linkStatus)) {
      const cancellation = await this.cancelPendingPaymentOrder(
        orderId,
        `Payment link ${linkStatus}`,
        { paymentReference: order.paymentReference, escrowStatus: "expired" },
      );

      const cancelledOrder = cancellation.data ?? order;
      return this.Result(
        false,
        "Payment was not completed",
        this.withVerificationResult(
          cancelledOrder,
          "failed",
          paymentLink.status,
        ),
        200,
      );
    }

    return this.Result(
      false,
      "Payment not completed yet",
      this.withVerificationResult(order, "pending", paymentLink.status),
    );
  }

  private toPaymentReturnSummary(
    order: OrderDocument & OrderPaymentVerificationResult,
  ): PaymentReturnSummary {
    return {
      orderId: String(order._id),
      orderRef: order.orderRef,
      paymentStatus: order.paymentStatus,
      kashiaPaymentLinkStatus: order.kashiaPaymentLinkStatus,
    };
  }

  /** Creates a fresh Kashia payment link for an unpaid order the shopper owns. */
  async createOrderPaymentLink(
    userId: string,
    orderId: string,
  ): PromisifiedOperationFeedback<OrderDocument> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectOrderId = this.utilsService.objectIdFromString(orderId);

    const order = await this.ordersRepository.query({
      _id: objectOrderId,
      userId: objectUserId,
    });

    if (!order) {
      return this.Result(true, "Order not found", undefined, 404);
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return this.Result(
        true,
        "This order is no longer awaiting payment",
        undefined,
        400,
      );
    }

    if (!this.kashiaService.isConfigured()) {
      return this.Result(
        true,
        "Payment is not available right now",
        undefined,
        503,
      );
    }

    if (!order.vendorId) {
      return this.Result(true, "Order is missing store information", undefined, 400);
    }

    // An order keeps one payment link. Minting another while the first is
    // still payable let a shopper pay twice for the same order.
    if (order.paymentReference) {
      const existingLink = await this.resolveOrderPaymentVerification(
        orderId,
        userId,
      );
      if (existingLink.failed) {
        return this.Result(
          true,
          "We couldn't check your existing payment. Please try again shortly.",
          undefined,
          existingLink.code ?? 502,
        );
      }

      switch (existingLink.data?.paymentStatus) {
        case "pending":
          if (order.paymentUrl) {
            return this.Result(false, "Payment link is still active", order);
          }
          break;
        case "confirmed":
        case "already_confirmed":
          return this.Result(
            true,
            "This order has already been paid",
            undefined,
            409,
          );
        case "failed":
          return this.Result(
            true,
            "This order has expired. Please check out again.",
            undefined,
            400,
          );
      }
    }

    try {
      const updatedOrder = await this.attachKashiaPaymentLink(order, userId);
      return this.Result(false, "Payment link created", updatedOrder);
    } catch (error) {
      this.logger.error(
        `Kashia payment link failed for order ${orderId}`,
        error,
      );
      return this.Result(
        true,
        "Unable to start payment. Please try again.",
        undefined,
        502,
      );
    }
  }

  private async attachKashiaPaymentLink(
    order: OrderDocument,
    userId: string,
  ): Promise<OrderDocument> {
    const vendorId = String(order.vendorId);
    const buyerCustomerId = await this.kashiaService.getOrCreateCustomer(userId);
    const sellerCustomerId =
      await this.kashiaService.getOrCreateVendorCustomer(vendorId);

    const commissionPercentage =
      await this.platformSettingsService.getCommissionPercentage();

    const itemCount = Array.isArray(order.items) ? order.items.length : 0;

    const paymentLink = await this.kashiaService.createPaymentLink({
      buyer_user_id: buyerCustomerId,
      seller_user_id: sellerCustomerId,
      title: `Traffik order ${order.orderRef ?? order._id}`,
      description: `${itemCount} item(s) from store checkout`,
      amount: nairaToKobo(order.total),
      merchant_fee_percentage: commissionPercentage,
      metadata: {
        orderId: String(order._id),
        orderRef: order.orderRef ?? "",
        vendorId,
      },
      redirect_url: getAppWebUrl(
        `/payment/return?order=${String(order._id)}`,
      ),
    });

    return this.ordersRepository.update(
      { _id: order._id },
      {
        paymentReference: paymentLink.reference,
        paymentUrl: paymentLink.payment_url,
        escrowStatus: "pending",
      },
    );
  }

  private withVerificationResult(
    order: OrderDocument,
    paymentStatus: OrderPaymentVerificationStatus,
    kashiaPaymentLinkStatus?: string,
  ): OrderDocument & OrderPaymentVerificationResult {
    const plain =
      typeof order.toObject === "function" ? order.toObject() : { ...order };

    return {
      ...plain,
      paymentStatus,
      kashiaPaymentLinkStatus,
    } as OrderDocument & OrderPaymentVerificationResult;
  }

  async findOrderIdByPaymentReference(
    reference: string,
  ): Promise<string | undefined> {
    const order = await this.ordersRepository.query({ paymentReference: reference });
    return order ? String(order._id) : undefined;
  }

  async updateOrderEscrowFields(
    orderId: string,
    fields: OrderEscrowFields,
    options: UpdateOrderEscrowOptions = {},
  ): Promise<void> {
    const objectOrderId = this.utilsService.objectIdFromString(orderId);
    const update = this.escrowFieldsToSet(fields);

    if (Object.keys(update).length === 0) {
      return;
    }

    await this.ordersRepository.update(
      {
        _id: objectOrderId,
        ...(options.onlyIfOrderStatus && { status: options.onlyIfOrderStatus }),
        ...(options.onlyIfNoEscrowId && { escrowId: null }),
      },
      update,
    );
  }

  /**
   * Cancels an unpaid order (payment link expired, checkout replaced, or hold
   * timed out) and returns its stock.
   *
   * The status change is a single conditional update and happens before stock
   * is returned, so a payment landing at the same moment is either confirmed
   * (and this call is a no-op) or rejected as late — never confirmed against
   * stock that was already released.
   */
  async cancelPendingPaymentOrder(
    orderId: string,
    reason: string,
    options: CancelPendingPaymentOptions = {},
  ): PromisifiedOperationFeedback<OrderDocument> {
    const objectOrderId = this.utilsService.objectIdFromString(orderId);
    const order = await this.ordersRepository.query({ _id: objectOrderId });

    if (!order) {
      return this.Result(true, "Order not found", undefined, 404);
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return this.Result(false, "Order is not awaiting payment", order, 200);
    }

    // Only the order's current link may cancel it: a replaced link expiring
    // must not cancel an order whose newer link is still payable.
    const guardsReference =
      !!options.paymentReference && !!order.paymentReference;
    if (
      guardsReference &&
      options.paymentReference !== order.paymentReference
    ) {
      return this.Result(
        false,
        "Payment link is no longer the order's active link",
        order,
        200,
      );
    }

    const updatedOrder = await this.applyStatusTransition(
      order,
      OrderStatus.CANCELLED,
      reason,
      {
        set: options.escrowStatus ? { escrowStatus: options.escrowStatus } : {},
        filter: guardsReference
          ? { paymentReference: options.paymentReference }
          : {},
      },
    );

    if (!updatedOrder) {
      const current = await this.ordersRepository.query({
        _id: objectOrderId,
      });
      return this.Result(false, "Order is not awaiting payment", current, 200);
    }

    return this.Result(false, "Pending payment order cancelled", updatedOrder);
  }

  /** Shopper confirms receipt after the store marks the order shipped. */
  async confirmOrderDelivery(
    userId: string,
    orderId: string,
  ): PromisifiedOperationFeedback<OrderDocument> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectOrderId = this.utilsService.objectIdFromString(orderId);

    const order = await this.ordersRepository.query({
      _id: objectOrderId,
      userId: objectUserId,
    });

    if (!order) {
      return this.Result(true, "Order not found", undefined, 404);
    }

    if (order.status !== OrderStatus.SHIPPED) {
      return this.Result(
        true,
        `Order cannot be confirmed. Current status: ${order.status}`,
        undefined,
        400,
      );
    }

    return this.updateOrderStatus(
      orderId,
      OrderStatus.DELIVERED,
      "Delivery confirmed by customer",
    );
  }

  /**
   * Line items from the user's orders that still need a product review.
   * Without `status`: orders in PROCESSING, DELIVERED, or CANCELLED.
   * With `status`: only that order status.
   */
  async getPendingReviewLineItems(
    userId: string,
    options: PaginationOptions & { status?: OrderStatus } = {
      page: 1,
      limit: 10,
    },
  ): PromisifiedOperationFeedback<PaginatedResponse<IPendingReviewLineItem>> {
    try {
      const objectUserId = this.utilsService.objectIdFromString(userId);
      const pageNum = Math.max(1, Number(options.page) || 1);
      const limitNum = Math.max(1, Number(options.limit) || 10);

      if (
        options.status != null &&
        !Object.values(OrderStatus).includes(options.status)
      ) {
        return this.Result(true, "Invalid order status filter", undefined, 400);
      }

      const orderStatusMatch =
        options.status != null
          ? { status: options.status }
          : { status: { $in: DEFAULT_PENDING_REVIEW_ORDER_STATUSES } };

      const skip = (pageNum - 1) * limitNum;

      const pipeline: PipelineStage[] = [
        { $match: { userId: objectUserId, ...orderStatusMatch } },
        { $unwind: { path: "$items" } },
        {
          $addFields: {
            productObjectId: {
              $convert: {
                input: "$items.productId",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        { $match: { productObjectId: { $ne: null } } },
        {
          $lookup: {
            from: DBCollectionNames.PRODUCT_REVIEWS,
            let: { pid: "$productObjectId", uid: "$userId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$productId", "$$pid"] },
                      { $eq: ["$userId", "$$uid"] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: "_hasReview",
          },
        },
        { $match: { _hasReview: { $size: 0 } } },
        {
          $lookup: {
            from: DBCollectionNames.PRODUCTS,
            localField: "productObjectId",
            foreignField: "_id",
            as: "_product",
          },
        },
        { $unwind: { path: "$_product", preserveNullAndEmptyArrays: false } },
        { $match: { "_product.status": ProductStatus.ACTIVE } },
        {
          $addFields: {
            deliveredAt: {
              $let: {
                vars: {
                  deliveredEvents: {
                    $filter: {
                      input: "$timeline",
                      as: "t",
                      cond: {
                        $eq: ["$$t.status", OrderStatus.DELIVERED],
                      },
                    },
                  },
                },
                in: { $max: "$$deliveredEvents.date" },
              },
            },
          },
        },
        {
          $addFields: {
            displayDate: {
              $ifNull: ["$deliveredAt", "$updatedAt"],
            },
          },
        },
        { $sort: { displayDate: -1, updatedAt: -1 } },
        {
          $facet: {
            rows: [
              { $skip: skip },
              { $limit: limitNum },
              {
                $project: {
                  _id: 0,
                  orderId: { $toString: "$_id" },
                  orderStatus: "$status",
                  productId: { $toString: "$productObjectId" },
                  productName: "$_product.name",
                  productImage: { $arrayElemAt: ["$_product.images", 0] },
                  quantity: "$items.quantity",
                  displayDate: 1,
                },
              },
            ],
            total: [{ $count: "count" }],
          },
        },
      ];

      const agg = await this.ordersRepository.model
        .aggregate<{
          rows: Array<{
            orderId: string;
            orderStatus: string;
            productId: string;
            productName: string;
            productImage?: string;
            quantity: number;
            displayDate?: Date;
          }>;
          total: Array<{ count: number }>;
        }>(pipeline)
        .exec();

      const facet = agg[0];
      const rawRows = facet?.rows ?? [];
      const totalNum = facet?.total?.[0]?.count ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalNum / limitNum));

      const items: IPendingReviewLineItem[] = rawRows.map((row) => {
        const orderId = row.orderId;
        return {
          orderId,
          orderNumber: this.formatOrderDisplayNumber(orderId),
          orderStatus: row.orderStatus,
          productId: row.productId,
          productName: row.productName,
          productImage: row.productImage ?? null,
          quantity: row.quantity ?? 1,
          date: row.displayDate
            ? new Date(row.displayDate).toISOString()
            : new Date().toISOString(),
          review: null,
        };
      });

      return this.Result(false, "Pending reviews retrieved", {
        items,
        meta: {
          total: totalNum,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
      });
    } catch (error: any) {
      this.logger.error(`getPendingReviewLineItems: ${error?.message}`);
      return this.Result(
        true,
        "Failed to load pending reviews",
        undefined,
        500,
      );
    }
  }

  /**
   * The reference shown to shoppers and stores. Prefers the stored `orderRef`
   * and falls back to the legacy derived number for orders created before
   * references were persisted.
   */
  private orderDisplayRef(order: {
    _id: unknown;
    orderRef?: string;
  }): string {
    return order.orderRef || this.formatOrderDisplayNumber(String(order._id));
  }

  private formatOrderDisplayNumber(orderIdHex: string): string {
    const hex = orderIdHex.replace(/[^a-fA-F0-9]/g, "");
    const tail = hex.slice(-7) || "0";
    const n = parseInt(tail, 16);
    const num = Number.isNaN(n) ? 0 : n % 10_000_000;
    return String(num).padStart(7, "0");
  }

  async getAdminOrders(
    options: PaginationOptions & {
      status?: OrderStatus;
      refundStatus?: OrderRefundStatus;
      /** Only orders with a payment alert no admin has resolved yet. */
      openAlertsOnly?: boolean;
    } = {
      page: 1,
      limit: 10,
    },
  ): PromisifiedOperationFeedback<PaginatedResponse<IOrder>> {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        refundStatus,
        openAlertsOnly,
      } = options;

      if (status != null && !Object.values(OrderStatus).includes(status)) {
        return this.Result(true, "Invalid order status filter", undefined, 400);
      }
      if (
        refundStatus != null &&
        !Object.values(OrderRefundStatus).includes(refundStatus)
      ) {
        return this.Result(
          true,
          "Invalid refund status filter",
          undefined,
          400,
        );
      }

      const filter = {
        ...(status != null ? { status } : {}),
        // Orders with at least one refund in this state, e.g. REQUIRED for
        // the queue of refunds still to be made.
        ...(refundStatus != null ? { "refunds.status": refundStatus } : {}),
        ...(openAlertsOnly
          ? { paymentAlerts: { $elemMatch: { resolvedAt: null } } }
          : {}),
      };

      const [result, total] = await Promise.all([
        this.ordersRepository.aggregate<OrderDocument>(
          filter,
          [{ $sort: { createdAt: -1 } }],
          {},
          { page, itemsPerPage: limit },
        ),
        this.ordersRepository.count(filter),
      ]);

      const response: PaginatedResponse<IOrder> = {
        items: (result?.items || []) as IOrder[],
        meta: {
          total: Number(total),
          page: Number(page),
          limit: Number(limit),
          totalPages: Number(result?.totalPages ?? 1),
        },
      };

      return this.Result(false, "Orders retrieved successfully", response);
    } catch (error: any) {
      this.logger.error(`Error retrieving admin orders: ${error?.message}`);
      return this.Result(true, "Failed to retrieve orders", undefined, 500);
    }
  }

  async getUserOrders(
    userId: string,
    options: PaginationOptions & { status?: OrderStatus } = {
      page: 1,
      limit: 10,
    },
  ): PromisifiedOperationFeedback<PaginatedResponse<IOrder>> {
    try {
      const objectUserId = this.utilsService.objectIdFromString(userId);
      const { page = 1, limit = 10, status } = options;

      if (status != null && !Object.values(OrderStatus).includes(status)) {
        return this.Result(true, "Invalid order status filter", undefined, 400);
      }

      const filter = {
        userId: objectUserId,
        ...(status != null ? { status } : {}),
      };

      const [result, total] = await Promise.all([
        this.ordersRepository.aggregate<OrderDocument>(
          filter,
          [{ $sort: { createdAt: -1 } }],
          {},
          { page, itemsPerPage: limit },
        ),
        this.ordersRepository.count(filter),
      ]);

      const response: PaginatedResponse<IOrder> = {
        items: (result?.items || []) as IOrder[],
        meta: {
          total: Number(total),
          page: Number(page),
          limit: Number(limit),
          totalPages: Number(result?.totalPages ?? 1),
        },
      };

      return this.Result(false, "Orders retrieved successfully", response);
    } catch (error: any) {
      this.logger.error(`Error retrieving user orders: ${error?.message}`);
      return this.Result(true, "Failed to retrieve orders", undefined, 500);
    }
  }

  async getOrderById(
    userId: string,
    orderId: string,
  ): PromisifiedOperationFeedback<OrderDocument> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectOrderId = this.utilsService.objectIdFromString(orderId);

    const order = await this.ordersRepository.query({
      _id: objectOrderId,
      userId: objectUserId,
    });

    if (!order) {
      return this.Result(true, "Order not found", undefined, 404);
    }

    return this.Result(false, "Order details retrieved", order);
  }

  async cancelOrder(
    userId: string,
    orderId: string,
  ): PromisifiedOperationFeedback<OrderDocument> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectOrderId = this.utilsService.objectIdFromString(orderId);

    const order = await this.ordersRepository.query({
      _id: objectOrderId,
      userId: objectUserId,
    });

    if (!order) {
      return this.Result(true, "Order not found", undefined, 404);
    }

    // A shopper may back out until the store has accepted; after that the store
    // is already working on it and cancellation is a support matter.
    if (!SHOPPER_CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
      return this.Result(
        true,
        `Order cannot be cancelled. Current status: ${order.status}`,
        undefined,
        400,
      );
    }

    const updatedOrder = await this.applyStatusTransition(
      order,
      OrderStatus.CANCELLED,
      "Order cancelled by user",
    );
    if (!updatedOrder) {
      return this.concurrentUpdateResult(objectOrderId);
    }

    void this.dispatchOrderStatusEmail(updatedOrder, OrderStatus.CANCELLED);

    return this.Result(false, "Order cancelled successfully", updatedOrder);
  }

  /**
   * @param actor who is driving the change. Vendors are limited to the fulfilment
   *   transitions; admins may make any legal transition in order to intervene.
   * @param vendorId when the actor is a vendor, scopes the order to that store.
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    description: string,
    actor: "ADMIN" | "VENDOR" = "ADMIN",
    vendorId?: string,
  ): PromisifiedOperationFeedback<OrderDocument> {
    // A store may only touch its own orders; refuse rather than fall back to
    // an unscoped lookup if the store is not identified.
    if (actor === "VENDOR" && !vendorId) {
      return this.Result(true, "Store not identified", undefined, 403);
    }

    const objectOrderId = this.utilsService.objectIdFromString(orderId);

    const order = await this.ordersRepository.query({
      _id: objectOrderId,
      ...(actor === "VENDOR" && {
        vendorId: this.utilsService.objectIdFromString(vendorId),
      }),
    });

    if (!order) {
      return this.Result(true, "Order not found", undefined, 404);
    }

    if (actor === "VENDOR" && !VENDOR_ORDER_TRANSITIONS.includes(status)) {
      return this.Result(
        true,
        `A store cannot move an order to ${status}`,
        undefined,
        403,
      );
    }

    // Previously any status could be set from any status, which allowed a
    // delivered order to be walked backwards.
    if (!canTransitionOrderStatus(order.status, status)) {
      return this.Result(
        true,
        `An order cannot go from ${order.status} to ${status}`,
        undefined,
        400,
      );
    }

    // Declined or cancelled orders never ship, so the helper puts their
    // inventory back on sale (once, even under concurrent updates).
    const updatedOrder = await this.applyStatusTransition(
      order,
      status,
      description,
    );
    if (!updatedOrder) {
      return this.concurrentUpdateResult(objectOrderId);
    }

    void this.dispatchOrderStatusEmail(updatedOrder, status, description);

    return this.Result(false, "Order status updated", updatedOrder);
  }

  private async dispatchOrderCreatedEmails(order: OrderDocument): Promise<void> {
    try {
      const orderId = String(order._id);
      const orderRef = this.orderDisplayRef(order);
      const user = await this.usersRepository.query({ _id: order.userId });
      if (!user?.email) return;

      const items = await this.resolveOrderLineItems(order.items || []);
      await this.emailService.sendSafe({
        to: user.email,
        template: EmailTemplate.ORDER_CONFIRMATION,
        data: {
          name: user.firstName,
          orderRef,
          items,
          total: order.total,
          orderUrl: getAppWebUrl(`/account/orders/${orderId}`),
        },
      });

      await this.notifyVendorsOfNewOrder(order, orderRef, user.firstName);
    } catch (error) {
      this.logger.error(
        `dispatchOrderCreatedEmails: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async dispatchOrderStatusEmail(
    order: OrderDocument,
    status: OrderStatus,
    note?: string,
  ): Promise<void> {
    try {
      const orderId = String(order._id);
      const orderRef = this.orderDisplayRef(order);
      const user = await this.usersRepository.query({ _id: order.userId });
      if (!user?.email) return;

      await this.emailService.sendSafe({
        to: user.email,
        template: EmailTemplate.ORDER_STATUS_UPDATE,
        data: {
          name: user.firstName,
          orderRef,
          status,
          statusLabel: getOrderStatusLabel(status),
          orderUrl: getAppWebUrl(`/account/orders/${orderId}`),
          note,
        },
      });
    } catch (error) {
      this.logger.error(
        `dispatchOrderStatusEmail: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Tells the shopper a refund was sent by hand, with the reference to look for. */
  private async dispatchRefundSentEmail(
    order: OrderDocument,
    refund: IOrderRefund,
  ): Promise<void> {
    try {
      if (!refund.payout) return;
      const user = await this.usersRepository.query({ _id: order.userId });
      if (!user?.email) return;

      await this.emailService.sendSafe({
        to: user.email,
        template: EmailTemplate.REFUND_SENT,
        data: {
          name: user.firstName,
          orderRef: this.orderDisplayRef(order),
          amount: refund.amount,
          methodLabel: REFUND_PAYOUT_METHOD_LABELS[refund.payout.method],
          reference: refund.payout.reference,
          note: refund.note,
          orderUrl: getAppWebUrl(`/account/orders/${String(order._id)}`),
          reportWindowDays: REFUND_NOT_RECEIVED_WINDOW_DAYS,
        },
      });
    } catch (error) {
      this.logger.error(
        `dispatchRefundSentEmail: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async resolveOrderLineItems(
    items: ICartItem[],
  ): Promise<EmailOrderLine[]> {
    if (!items.length) return [];

    const productIds = items
      .map((item) => this.utilsService.objectIdFromString(item.productId))
      .filter(Boolean);

    const products = await this.productsRepository.model
      .find({ _id: { $in: productIds } })
      .select("name vendorId")
      .lean();

    const productMap = new Map(
      products.map((product) => [String(product._id), product]),
    );

    return items.map((item) => {
      const product = productMap.get(String(item.productId));
      return {
        name: product?.name || "Product",
        quantity: item.quantity,
        price: item.total,
      };
    });
  }

  /**
   * An order belongs to one store, so this resolves the vendor directly rather
   * than reverse-deriving it from every line's product.
   */
  private async notifyVendorsOfNewOrder(
    order: OrderDocument,
    orderRef: string,
    customerName: string,
  ): Promise<void> {
    const items = order.items || [];
    if (!items.length) return;

    const vendorId = order.vendorId
      ? String(order.vendorId)
      : await this.resolveLegacyOrderVendorId(order);
    if (!vendorId) return;

    const vendor = await this.vendorsRepository.query({ _id: vendorId });
    if (!vendor?.email) return;

    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    await this.emailService.sendSafe({
      to: vendor.email,
      template: EmailTemplate.VENDOR_NEW_ORDER,
      data: {
        vendorName: vendor.businessName || vendor.firstName,
        orderRef,
        customerName,
        itemCount,
        total: order.subtotal,
        dashboardUrl: getAppWebUrl("/dashboard/orders"),
      },
    });
  }

  /** Vendor for orders written before `Order.vendorId` existed. */
  private async resolveLegacyOrderVendorId(
    order: OrderDocument,
  ): Promise<string | null> {
    const firstItem = (order.items || [])[0];
    if (!firstItem) return null;

    const product = await this.productsRepository.model
      .findById(this.utilsService.objectIdFromString(firstItem.productId))
      .select("vendorId")
      .lean();

    return product?.vendorId ? String(product.vendorId) : null;
  }

  /**
   * Confirms the buyer owns the order, it is delivered, and the product appears on the order.
   * Used when creating verified-purchase product reviews.
   */
  /**
   * Products ranked by how many distinct (non-cancelled) orders include them.
   * Used for trending products.
   */
  async getTopProductIdsByDistinctOrderCount(
    limit: number,
  ): Promise<Array<{ productId: Types.ObjectId; orderCount: number }>> {
    const safeLimit = Math.min(
      500,
      Math.max(1, Math.floor(Number(limit)) || 1),
    );

    const pipeline: PipelineStage[] = [
      { $match: { status: { $ne: OrderStatus.CANCELLED } } },
      { $unwind: { path: "$items" } },
      {
        $addFields: {
          productObjectId: {
            $convert: {
              input: "$items.productId",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      { $match: { productObjectId: { $ne: null } } },
      {
        $group: {
          _id: "$productObjectId",
          orderIds: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          orderCount: { $size: "$orderIds" },
        },
      },
      { $sort: { orderCount: -1, productId: 1 } },
      { $limit: safeLimit },
    ];

    return this.ordersRepository.model
      .aggregate<{ productId: Types.ObjectId; orderCount: number }>(pipeline)
      .exec();
  }

  async verifyDeliveredOrderContainsProduct(
    userId: string,
    orderId: string,
    productId: string,
  ): Promise<boolean> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectOrderId = this.utilsService.objectIdFromString(orderId);
    const objectProductId = this.utilsService.objectIdFromString(productId);

    const order = await this.ordersRepository.query({
      _id: objectOrderId,
      userId: objectUserId,
    });

    if (!order) {
      return false;
    }

    if (order.status !== OrderStatus.DELIVERED) {
      return false;
    }

    const items = order.items || [];
    const target = objectProductId.toString();
    return items.some((item: { productId?: unknown }) => {
      const pid = item?.productId;
      if (pid == null) {
        return false;
      }
      return String(pid) === target;
    });
  }

  async getMyOrders(
    userId: string,
    options: PaginationOptions & { status?: "OPEN" | "CLOSED" } = {
      page: 1,
      limit: 10,
    },
  ): PromisifiedOperationFeedback<PaginatedResponse<any>> {
    try {
      const objectUserId = this.utilsService.objectIdFromString(userId);
      const pageNum = Math.max(1, Number(options.page) || 1);
      const limitNum = Math.max(1, Number(options.limit) || 10);
      const skip = (pageNum - 1) * limitNum;

      let statusMatch: any = {};
      if (options.status === "OPEN") {
        statusMatch = {
          status: {
            $in: [
              OrderStatus.PENDING_PAYMENT,
              OrderStatus.PENDING,
              OrderStatus.ACCEPTED,
              OrderStatus.PROCESSING,
              OrderStatus.SHIPPED,
            ],
          },
        };
      } else if (options.status === "CLOSED") {
        statusMatch = {
          status: {
            $in: [
              OrderStatus.DELIVERED,
              OrderStatus.CANCELLED,
              OrderStatus.REJECTED,
            ],
          },
        };
      }

      const pipeline: PipelineStage[] = [
        { $match: { userId: objectUserId, ...statusMatch } },
        { $unwind: { path: "$items" } },
        {
          $addFields: {
            productObjectId: {
              $convert: {
                input: "$items.productId",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: DBCollectionNames.PRODUCTS,
            localField: "productObjectId",
            foreignField: "_id",
            as: "_product",
          },
        },
        { $unwind: { path: "$_product", preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            rows: [
              { $skip: skip },
              { $limit: limitNum },
              {
                $project: {
                  _id: 0,
                  orderId: { $toString: "$_id" },
                  orderStatus: "$status",
                  statusDescription: {
                    $let: {
                      vars: {
                        lastTimeline: { $arrayElemAt: ["$timeline", -1] },
                      },
                      in: "$$lastTimeline.description",
                    },
                  },
                  productId: { $toString: "$productObjectId" },
                  productName: {
                    $ifNull: ["$_product.name", "Unknown Product"],
                  },
                  productImage: { $arrayElemAt: ["$_product.images", 0] },
                  attributes: { $ifNull: ["$items.variation.attributes", {}] },
                  quantity: "$items.quantity",
                  price: "$items.price",
                  total: "$items.total",
                  createdAt: 1,
                },
              },
            ],
            total: [{ $count: "count" }],
          },
        },
      ];

      const agg = await this.ordersRepository.model
        .aggregate<any>(pipeline)
        .exec();

      const facet = agg[0];
      const rawRows = facet?.rows ?? [];
      const totalNum = facet?.total?.[0]?.count ?? 0;
      const totalPages = Math.max(1, Math.ceil(totalNum / limitNum));

      const items = rawRows.map((row) => ({
        ...row,
        orderNumber: this.formatOrderDisplayNumber(row.orderId),
        date: row.createdAt,
      }));

      return this.Result(false, "My orders retrieved", {
        items,
        meta: {
          total: totalNum,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
      });
    } catch (error: any) {
      this.logger.error(`getMyOrders: ${error?.message}`);
      return this.Result(true, "Failed to load orders", undefined, 500);
    }
  }
}
