import { Logger } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Types } from "mongoose";
import { OrdersService } from "./orders.service";
import { OrdersRepository } from "../repositories/orders.repository";
import { DeliveryMethod, OrderStatus } from "../enums/order.enum";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { CartsService } from "src/modules/carts/services/carts.service";
import { AddressesService } from "src/modules/addresses/services/addresses.service";
import { EmailService } from "src/modules/shared/services/email/email.service";
import { UsersRepository } from "src/modules/users/repositories/users.repository";
import { ProductsRepository } from "src/modules/products/repositories/products.repository";
import { VendorsRepository } from "src/modules/vendors/repositories/vendors.repository";
import { KashiaService } from "src/modules/escrow/services/kashia.service";
import { PlatformSettingsService } from "src/modules/admin/services/platform-settings.service";
import { ProductStatus } from "src/modules/products/enums/product-status.enum";
import {
  PENDING_PAYMENT_MAX_HOLD_MS,
  STALE_HOLD_RECHECK_MS,
  STALE_HOLD_RECLAIM_LIMIT,
} from "../constants/order-inventory.constant";
import {
  OrderRefundActor,
  OrderRefundEventType,
  OrderRefundPayoutMethod,
  OrderRefundReason,
  OrderRefundResolution,
  OrderRefundStatus,
} from "../enums/order-refund.enum";
import { newRefundRecord } from "../utils/order-refund.util";
import {
  EscrowLifecycleEvent,
  OrderPaymentAlertType,
  TERMINAL_ESCROW_STATUSES,
} from "../enums/order-escrow.enum";
import { RefundPayoutReferencesRepository } from "../repositories/refund-payout-references.repository";
import { KashiaWebhookService } from "src/modules/escrow/services/kashia-webhook.service";
import { TransactionsService } from "src/modules/shared/services/transactions/transactions.service";
import { KashiaWebhookEventsRepository } from "src/modules/escrow/repositories/kashia-webhook-events.repository";
import { EmailTemplate } from "src/modules/shared/services/email/enums/email_template.enum";

/**
 * Order lifecycle against in-memory stores that follow MongoDB's
 * single-document rules: a conditional update checks and writes in one step,
 * and every call yields first, so concurrent callers interleave at each await
 * the way they do against a real database.
 */

type Doc = Record<string, any>;

const tick = () => new Promise((resolve) => setImmediate(resolve));
/** Deep copy that, unlike structuredClone, keeps ObjectId instances intact. */
const clone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value instanceof Types.ObjectId) return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, clone(entry)]),
    ) as T;
  }
  return value;
};
const same = (a: unknown, b: unknown) => String(a) === String(b);

/**
 * A transaction as the fakes see it: each write made with it records how to
 * undo itself, and an aborted transaction is undone in reverse, as MongoDB
 * rolls back a transaction that fails or whose process dies before commit.
 */
type FakeSession = { undo: Array<() => void> };
const onAbort = (session: unknown, undo: () => void) =>
  (session as FakeSession | undefined)?.undo.push(undo);

/** TransactionsService over the fakes; `supported: false` is a standalone server. */
class FakeTransactions {
  supported = true;

  async run<T>(work: (session?: FakeSession) => Promise<T>): Promise<T> {
    if (!this.supported) return work(undefined);
    const session: FakeSession = { undo: [] };
    try {
      return await work(session);
    } catch (error) {
      for (const undo of session.undo.reverse()) undo();
      throw error;
    }
  }
}

class FakeOrdersRepository {
  readonly orders = new Map<string, Doc>();
  failNextCreate = false;
  private seq = 0;

  private matches(order: Doc, filter: Doc): boolean {
    return Object.entries(filter).every(([key, value]) => {
      // As in MongoDB, `null` matches a missing field.
      if (value === null) return order[key] == null;
      if (value && typeof value === "object" && "$ne" in value) {
        const field = order[key];
        return Array.isArray(field)
          ? !field.some((entry) => same(entry, value.$ne))
          : !same(field, value.$ne);
      }
      return same(order[key], value);
    });
  }

  async query(filter: Doc) {
    await tick();
    const order = [...this.orders.values()].find((o) =>
      this.matches(o, filter),
    );
    return order ? clone(order) : null;
  }

  async create(doc: Doc) {
    await tick();
    if (this.failNextCreate) {
      this.failNextCreate = false;
      return null; // BaseRepository.create reports failures as null
    }
    const created = {
      ...clone(doc),
      _id: new Types.ObjectId(),
      createdAt: new Date(Date.now() + this.seq++),
    };
    this.orders.set(String(created._id), created);
    return clone(created);
  }

  /** Same contract as OrdersRepository.insertOrder: throws on failure. */
  async insertOrder(doc: Doc, session?: unknown) {
    await tick();
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new Error("insert failed");
    }
    const created = {
      ...clone(doc),
      _id: new Types.ObjectId(),
      createdAt: new Date(Date.now() + this.seq++),
    };
    this.orders.set(String(created._id), created);
    onAbort(session, () => this.orders.delete(String(created._id)));
    return clone(created);
  }

  async update(filter: Doc, update: Doc) {
    await tick();
    const order = [...this.orders.values()].find((o) =>
      this.matches(o, filter),
    );
    if (!order) return null;
    Object.assign(order, clone(update.$set ?? update));
    return clone(order);
  }

  async transitionStatus(
    orderId: Types.ObjectId,
    fromStatus: OrderStatus,
    update: Doc,
    returnUpdated = true,
    extraFilter: Doc = {},
    session?: unknown,
  ) {
    await tick();
    const order = this.orders.get(String(orderId));
    if (
      !order ||
      order.status !== fromStatus ||
      !this.matches(order, extraFilter)
    ) {
      return null;
    }
    const before = clone(order);
    onAbort(session, () => this.orders.set(String(orderId), clone(before)));
    Object.assign(order, clone(update.$set ?? {}));
    for (const [key, value] of Object.entries(update.$push ?? {})) {
      // Mongoose gives refund subdocuments their own _id.
      const entry =
        key === "refunds"
          ? {
              _id: new Types.ObjectId(),
              ...clone(value as Doc),
              history: (value as Doc).history.map((e: Doc) => ({
                _id: new Types.ObjectId(),
                ...clone(e),
              })),
            }
          : clone(value);
      order[key] = [...(order[key] ?? []), entry];
    }
    return returnUpdated ? clone(order) : before;
  }

  private refundWhere(orderId: unknown, where: (r: Doc) => boolean) {
    const order = this.orders.get(String(orderId));
    return { order, refund: (order?.refunds ?? []).find(where) };
  }

  private static fieldsMatch(refund: Doc, match: Doc) {
    return Object.entries(match).every(([key, value]) =>
      value === null ? refund[key] == null : same(refund[key], value),
    );
  }

  /** Same rules as OrdersRepository.addRefund: at most one refund per escrow. */
  async addRefund(orderId: unknown, refund: Doc) {
    await tick();
    const order = this.orders.get(String(orderId));
    if (!order) return false;
    order.refunds = order.refunds ?? [];
    if (order.refunds.some((r: Doc) => r.escrowId === refund.escrowId)) {
      return false;
    }
    const opened = order.refunds.find(
      (r: Doc) =>
        r.escrowId == null &&
        refund.paymentReference &&
        r.paymentReference === refund.paymentReference,
    );
    if (opened) {
      opened.escrowId = refund.escrowId;
      return false;
    }
    const record = newRefundRecord(refund as any);
    order.refunds.push({
      _id: new Types.ObjectId(),
      ...clone(record),
      history: record.history.map((e) => ({
        _id: new Types.ObjectId(),
        ...clone(e),
      })),
    });
    return true;
  }

  async markEscrowRefundedByProvider(orderId: unknown, escrowId: string) {
    await tick();
    const order = this.orders.get(String(orderId));
    if (!order) return;
    order.providerRefundedEscrowIds = [
      ...new Set([...(order.providerRefundedEscrowIds ?? []), escrowId]),
    ];
  }

  async completeRefundFromProvider(
    orderId: unknown,
    match: Doc,
    options: Doc = {},
  ) {
    await tick();
    const { order, refund } = this.refundWhere(
      orderId,
      (r) =>
        r.status === OrderRefundStatus.REQUIRED &&
        FakeOrdersRepository.fieldsMatch(r, match),
    );
    if (!order || !refund) return null;
    if (
      options.onlyIfProviderRefunded &&
      !(order.providerRefundedEscrowIds ?? []).includes(
        options.onlyIfProviderRefunded,
      )
    ) {
      return null;
    }
    const now = new Date();
    Object.assign(refund, {
      status: OrderRefundStatus.REFUNDED,
      refundedAt: now,
      resolvedBy: OrderRefundResolution.KASHIA,
      providerConfirmedAt: now,
      ...(options.attachEscrowId && { escrowId: options.attachEscrowId }),
    });
    refund.history.push({
      _id: new Types.ObjectId(),
      type: OrderRefundEventType.COMPLETED,
      actor: OrderRefundActor.KASHIA,
      at: now,
    });
    return clone(order);
  }

  async recordProviderRefundOfManualRefund(
    orderId: unknown,
    match: Doc,
    payoutMethod: string,
    possibleDoubleRefund: boolean,
  ) {
    await tick();
    const { order, refund } = this.refundWhere(
      orderId,
      (r) =>
        FakeOrdersRepository.fieldsMatch(r, match) &&
        r.status === OrderRefundStatus.REFUNDED &&
        r.resolvedBy === OrderRefundResolution.ADMIN &&
        r.payout?.method === payoutMethod &&
        r.providerConfirmedAt == null,
    );
    if (!order || !refund) return null;
    refund.providerConfirmedAt = new Date();
    refund.history.push({
      _id: new Types.ObjectId(),
      type: OrderRefundEventType.PROVIDER_REFUNDED,
      actor: OrderRefundActor.KASHIA,
      at: new Date(),
      possibleDoubleRefund,
    });
    return clone(order);
  }

  async completeRefundManually(orderId: unknown, refundId: unknown, c: Doc) {
    await tick();
    const { order, refund } = this.refundWhere(
      orderId,
      (r) => same(r._id, refundId) && r.status === OrderRefundStatus.REQUIRED,
    );
    if (!order || !refund) return null;
    const { method, reference, amount } = c.payout;
    const evidence = { method, reference, amount };
    Object.assign(refund, {
      status: OrderRefundStatus.REFUNDED,
      refundedAt: new Date(),
      resolvedBy: OrderRefundResolution.ADMIN,
      resolvedByAdminId: c.adminId,
      payout: clone(c.payout),
      completionId: c.completionId,
      ...(c.note && { note: c.note }),
    });
    refund.history.push({
      _id: c.completionId,
      type: OrderRefundEventType.COMPLETED,
      actor: OrderRefundActor.ADMIN,
      actorId: c.adminId,
      at: new Date(),
      payout: clone(evidence),
    });
    return clone(order);
  }

  async reopenRefund(orderId: unknown, refundId: unknown, reopen: Doc) {
    await tick();
    const order = this.orders.get(String(orderId));
    if (!order || !this.matches(order, reopen.orderFilter ?? {})) return null;
    const refund = (order.refunds ?? []).find(
      (r: Doc) =>
        same(r._id, refundId) &&
        r.status === OrderRefundStatus.REFUNDED &&
        r.resolvedBy === OrderRefundResolution.ADMIN &&
        r.providerConfirmedAt == null &&
        (!reopen.completionId || same(r.completionId, reopen.completionId)) &&
        (!reopen.refundedSince || r.refundedAt >= reopen.refundedSince),
    );
    if (!refund) return null;
    refund.status = OrderRefundStatus.REQUIRED;
    for (const key of [
      "refundedAt",
      "resolvedBy",
      "resolvedByAdminId",
      "payout",
      "completionId",
      "note",
    ]) {
      delete refund[key];
    }
    refund.history.push({
      _id: new Types.ObjectId(),
      type: OrderRefundEventType.REOPENED,
      actor: reopen.actor,
      actorId: reopen.actorId,
      at: new Date(),
      reason: reopen.reason,
    });
    return clone(order);
  }

  async findPendingPaymentOrdersForStore(userId: unknown, vendorId: unknown) {
    await tick();
    return [...this.orders.values()]
      .filter(
        (o) =>
          same(o.userId, userId) &&
          same(o.vendorId, vendorId) &&
          o.status === OrderStatus.PENDING_PAYMENT,
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(clone);
  }

  /** Same rules as OrdersRepository.findStalePendingPaymentOrders. */
  async findStalePendingPaymentOrders(query: {
    createdBefore: Date;
    checkedBefore: Date;
    maxHoldBefore: Date;
    limit: number;
    productIds?: unknown[];
  }) {
    await tick();
    const productIds = query.productIds ?? [];
    const checkedFirst = (o: Doc) =>
      o.stockHoldCheckedAt ? o.stockHoldCheckedAt.getTime() : -Infinity;
    return [...this.orders.values()]
      .filter(
        (o) =>
          o.status === OrderStatus.PENDING_PAYMENT &&
          o.createdAt < query.createdBefore &&
          (o.stockHoldCheckedAt == null ||
            o.stockHoldCheckedAt < query.checkedBefore ||
            o.createdAt < query.maxHoldBefore) &&
          (!productIds.length ||
            o.items.some((item: Doc) =>
              productIds.some((id) => same(id, item.productId)),
            )),
      )
      .sort(
        (a, b) =>
          checkedFirst(a) - checkedFirst(b) || a.createdAt - b.createdAt,
      )
      .slice(0, query.limit)
      .map(clone);
  }

  async markStockHoldChecked(orderId: unknown, checkedAt: Date) {
    await tick();
    const order = this.orders.get(String(orderId));
    if (order?.status === OrderStatus.PENDING_PAYMENT) {
      order.stockHoldCheckedAt = checkedAt;
    }
  }

  /** Same rules as OrdersRepository.adoptEscrow. */
  async adoptEscrow(
    orderId: unknown,
    escrowId: string,
    paymentReference: string,
  ) {
    await tick();
    const order = this.orders.get(String(orderId));
    if (
      !order ||
      order.escrowId != null ||
      order.paymentReference !== paymentReference
    ) {
      return false;
    }
    order.escrowId = escrowId;
    return true;
  }

  /** Same rules as OrdersRepository.mirrorEscrowStatus. */
  async mirrorEscrowStatus(
    orderId: unknown,
    escrowId: string,
    escrowStatus: string,
    occurredAt?: Date,
  ) {
    await tick();
    const order = this.orders.get(String(orderId));
    if (!order || order.escrowId !== escrowId) return false;
    if (
      !TERMINAL_ESCROW_STATUSES.includes(escrowStatus) &&
      TERMINAL_ESCROW_STATUSES.includes(order.escrowStatus)
    ) {
      return false;
    }
    if (
      occurredAt &&
      order.escrowStatusAt &&
      order.escrowStatusAt > occurredAt
    ) {
      return false;
    }
    order.escrowStatus = escrowStatus;
    if (occurredAt) order.escrowStatusAt = occurredAt;
    return true;
  }

  /** Same rules as OrdersRepository.addPaymentAlert: once per type and escrow. */
  async addPaymentAlert(orderId: unknown, alert: Doc) {
    await tick();
    const order = this.orders.get(String(orderId));
    if (!order) return false;
    order.paymentAlerts = order.paymentAlerts ?? [];
    if (
      order.paymentAlerts.some(
        (a: Doc) =>
          a.type === alert.type &&
          (a.escrowId ?? null) === (alert.escrowId ?? null),
      )
    ) {
      return false;
    }
    order.paymentAlerts.push({
      _id: new Types.ObjectId(),
      ...clone(alert),
      raisedAt: new Date(),
    });
    return true;
  }

  async resolvePaymentAlert(orderId: unknown, alertId: unknown, r: Doc) {
    await tick();
    const order = this.orders.get(String(orderId));
    const alert = (order?.paymentAlerts ?? []).find(
      (a: Doc) => same(a._id, alertId) && a.resolvedAt == null,
    );
    if (!order || !alert) return null;
    Object.assign(alert, {
      resolvedAt: new Date(),
      resolvedByAdminId: r.adminId,
      resolutionNote: r.note,
    });
    return clone(order);
  }

  only(): Doc {
    expect(this.orders.size).toBe(1);
    return [...this.orders.values()][0];
  }
}

/** Products collection supporting the stock operations the service issues. */
class FakeProductsModel {
  readonly products = new Map<string, Doc>();

  add(product: Doc) {
    this.products.set(String(product._id), clone(product));
  }

  stock(productId: unknown, variationId?: unknown): number {
    const product = this.products.get(String(productId))!;
    return variationId
      ? product.variations.find((v: Doc) => same(v._id, variationId)).quantity
      : product.defaultVariation.quantity;
  }

  async updateOne(filter: Doc, update: Doc, options: Doc = {}) {
    await tick();
    const product = this.products.get(String(filter._id));
    if (!product) return { modifiedCount: 0 };

    const [path, delta] = Object.entries(update.$inc)[0] as [string, number];
    if (path === "variations.$.quantity") {
      const wanted = filter.variations.$elemMatch;
      const variation = product.variations.find((v: Doc) =>
        same(v._id, wanted._id),
      );
      if (
        !variation ||
        (wanted.quantity && variation.quantity < wanted.quantity.$gte)
      ) {
        return { modifiedCount: 0 };
      }
      variation.quantity += delta;
      onAbort(options.session, () => (variation.quantity -= delta));
    } else {
      const guard = filter["defaultVariation.quantity"];
      if (guard && product.defaultVariation.quantity < guard.$gte) {
        return { modifiedCount: 0 };
      }
      product.defaultVariation.quantity += delta;
      onAbort(
        options.session,
        () => (product.defaultVariation.quantity -= delta),
      );
    }
    return { modifiedCount: 1 };
  }

  private readQuery(result: () => unknown) {
    const query = {
      select: () => query,
      lean: async () => {
        await tick();
        return clone(result());
      },
    };
    return query;
  }

  find(filter: Doc) {
    const ids: unknown[] = filter._id.$in;
    return this.readQuery(() =>
      [...this.products.values()].filter((p) =>
        ids.some((id) => same(id, p._id)),
      ),
    );
  }

  findById(id: unknown) {
    return this.readQuery(() => this.products.get(String(id)) ?? null);
  }
}

/** The per-shopper checkout lock, as CartsRepository implements it. */
class FakeCheckoutLock {
  private readonly locks = new Map<string, string>();

  async acquire(userId: string) {
    await tick();
    if (this.locks.has(userId)) return null;
    const token = String(new Types.ObjectId());
    this.locks.set(userId, token);
    return token;
  }

  /** A lock that expired is taken by the next checkout (a new token). */
  expire(userId: string) {
    this.locks.delete(userId);
  }

  /** Same rule as CartsRepository.confirmCheckoutLock. */
  async confirm(userId: string, token: string) {
    await tick();
    return this.locks.get(userId) === token;
  }

  async release(userId: string, token: string) {
    await tick();
    if (this.locks.get(userId) === token) this.locks.delete(userId);
  }
}

/** The payout-reference claims collection: a unique key per reference. */
class FakeRefundPayoutReferences {
  readonly claims = new Map<
    string,
    { orderId: string; refundId: string; completionId: string }
  >();

  async claim(
    referenceKey: string,
    orderId: unknown,
    refundId: unknown,
    completionId: unknown,
  ) {
    await tick();
    const existing = this.claims.get(referenceKey);
    if (!existing) {
      this.claims.set(referenceKey, {
        orderId: String(orderId),
        refundId: String(refundId),
        completionId: String(completionId),
      });
      return true;
    }
    if (
      existing.orderId === String(orderId) &&
      existing.refundId === String(refundId)
    ) {
      existing.completionId = String(completionId);
      return true;
    }
    return false;
  }

  async release(
    referenceKey: string,
    orderId: unknown,
    refundId: unknown,
    completionId: unknown,
  ) {
    await tick();
    const existing = this.claims.get(referenceKey);
    if (
      existing?.orderId === String(orderId) &&
      existing.refundId === String(refundId) &&
      existing.completionId === String(completionId)
    ) {
      this.claims.delete(referenceKey);
    }
  }
}

describe("OrdersService order lifecycle and inventory", () => {
  const userId = String(new Types.ObjectId());
  const otherUserId = String(new Types.ObjectId());
  const vendorId = new Types.ObjectId();
  const otherVendorId = new Types.ObjectId();
  const addressId = new Types.ObjectId();
  const productId = new Types.ObjectId();
  const variationId = new Types.ObjectId();
  const variedProductId = new Types.ObjectId();

  let service: OrdersService;
  let orders: FakeOrdersRepository;
  let products: FakeProductsModel;
  let lock: FakeCheckoutLock;
  let payoutRefs: FakeRefundPayoutReferences;
  let transactions: FakeTransactions;
  let emailService: { sendSafe: jest.Mock };
  let usersRepository: { query: jest.Mock };
  let cartItems: Doc[];
  let kashia: {
    isConfigured: jest.Mock;
    getOrCreateCustomer: jest.Mock;
    getOrCreateVendorCustomer: jest.Mock;
    createPaymentLink: jest.Mock;
    getPaymentLink: jest.Mock;
  };
  let cartsService: Record<string, jest.Mock>;
  let logs: { warn: jest.SpyInstance; error: jest.SpyInstance };

  const line = (quantity: number, overrides: Doc = {}) => ({
    productId,
    quantity,
    price: 1000,
    total: 1000 * quantity,
    ...overrides,
  });

  const checkout = (deliveryMethod = DeliveryMethod.PICKUP_STATION) =>
    service.createOrder(userId, {
      addressId: String(addressId),
      deliveryMethod,
    });

  /** An unpaid order from another shopper, created `ageMs` ago. */
  const seedUnpaidOrder = (
    ageMs: number,
    quantity: number,
    extra: Doc = {},
  ) => {
    const order = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(otherUserId),
      vendorId,
      orderRef: "TRF-STALE1",
      status: OrderStatus.PENDING_PAYMENT,
      items: [line(quantity)],
      total: 1000 * quantity,
      stockReserved: true,
      stockCommitted: false,
      timeline: [],
      createdAt: new Date(Date.now() - ageMs),
      ...extra,
    };
    products.products.get(String(productId))!.defaultVariation.quantity -=
      quantity;
    orders.orders.set(String(order._id), order);
    return order;
  };

  beforeEach(async () => {
    orders = new FakeOrdersRepository();
    products = new FakeProductsModel();
    lock = new FakeCheckoutLock();
    payoutRefs = new FakeRefundPayoutReferences();
    transactions = new FakeTransactions();
    emailService = { sendSafe: jest.fn() };
    usersRepository = { query: jest.fn().mockResolvedValue(null) };
    products.add({
      _id: productId,
      name: "Ankara Tote",
      status: ProductStatus.ACTIVE,
      vendorId,
      defaultVariation: { quantity: 5 },
      variations: [],
    });
    products.add({
      _id: variedProductId,
      name: "Sneakers",
      status: ProductStatus.ACTIVE,
      vendorId,
      defaultVariation: { quantity: 0 },
      variations: [{ _id: variationId, quantity: 3 }],
    });
    cartItems = [line(2)];

    let linkSeq = 0;
    kashia = {
      isConfigured: jest.fn().mockReturnValue(true),
      getOrCreateCustomer: jest.fn().mockResolvedValue("buyer-1"),
      getOrCreateVendorCustomer: jest.fn().mockResolvedValue("seller-1"),
      createPaymentLink: jest.fn().mockImplementation(async () => {
        linkSeq++;
        return {
          reference: `PL-${linkSeq}`,
          payment_url: `https://pay.example/PL-${linkSeq}`,
        };
      }),
      getPaymentLink: jest.fn().mockResolvedValue({ status: "active" }),
    };
    cartsService = {
      getCart: jest.fn().mockImplementation(async () => ({
        failed: false,
        data: {
          vendorId,
          items: clone(cartItems),
          hasVoucher: false,
        },
      })),
      acquireCheckoutLock: jest.fn((id: string) => lock.acquire(id)),
      confirmCheckoutLock: jest.fn((id: string, token: string) =>
        lock.confirm(id, token),
      ),
      releaseCheckoutLock: jest.fn((id: string, token: string) =>
        lock.release(id, token),
      ),
      clearCart: jest.fn().mockResolvedValue({ failed: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        UtilsService,
        { provide: OrdersRepository, useValue: orders },
        { provide: CartsService, useValue: cartsService },
        {
          provide: AddressesService,
          useValue: {
            getAddressById: jest.fn().mockResolvedValue({
              failed: false,
              data: { _id: addressId, street: "1 Marina" },
            }),
          },
        },
        { provide: EmailService, useValue: emailService },
        { provide: UsersRepository, useValue: usersRepository },
        { provide: RefundPayoutReferencesRepository, useValue: payoutRefs },
        { provide: TransactionsService, useValue: transactions },
        { provide: ProductsRepository, useValue: { model: products } },
        {
          provide: VendorsRepository,
          useValue: {
            query: jest.fn().mockResolvedValue({
              _id: vendorId,
              businessName: "Ada Stores",
              isActive: true,
              isApproved: true,
              pickupAvailable: true,
              deliveryFee: 500,
            }),
          },
        },
        { provide: KashiaService, useValue: kashia },
        {
          provide: PlatformSettingsService,
          useValue: {
            getCommissionPercentage: jest.fn().mockResolvedValue(10),
          },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    logs = {
      warn: jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined),
      error: jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined),
    };
  });

  afterEach(() => jest.restoreAllMocks());

  describe("placing an order", () => {
    it("reserves stock, opens a payment link and returns it", async () => {
      const result = await checkout();

      expect(result).toMatchObject({ failed: false, code: 201 });
      expect(result.data.paymentUrl).toBe("https://pay.example/PL-1");
      expect(products.stock(productId)).toBe(3);
      expect(orders.only()).toMatchObject({
        status: OrderStatus.PENDING_PAYMENT,
        stockReserved: true,
        paymentReference: "PL-1",
      });
    });

    it("lets only one of two simultaneous submits through", async () => {
      const [a, b] = await Promise.all([checkout(), checkout()]);

      const codes = [a.code, b.code].sort();
      expect(codes).toEqual([201, 409]);
      expect([a, b].find((r) => r.code === 409).description).toMatch(
        /checkout is already in progress/,
      );
      expect(orders.orders.size).toBe(1);
      expect(products.stock(productId)).toBe(3); // reserved once
    });

    it("hands back the same unpaid order when the shopper checks out the same cart again", async () => {
      const first = await checkout();
      const second = await checkout();

      expect(second).toMatchObject({ failed: false, code: 200 });
      expect(String(second.data._id)).toBe(String(first.data._id));
      expect(second.data.paymentUrl).toBe(first.data.paymentUrl);
      expect(orders.orders.size).toBe(1);
      expect(products.stock(productId)).toBe(3);
      expect(kashia.createPaymentLink).toHaveBeenCalledTimes(1);
    });

    it("replaces an earlier unpaid checkout whose cart has changed, returning its stock", async () => {
      const first = await checkout();
      cartItems = [line(1)];

      const second = await checkout();

      expect(second).toMatchObject({ failed: false, code: 201 });
      const earlier = orders.orders.get(String(first.data._id))!;
      expect(earlier.status).toBe(OrderStatus.CANCELLED);
      expect(earlier.timeline.at(-1).description).toBe(
        "Replaced by a newer checkout",
      );
      expect(products.stock(productId)).toBe(4); // 5 - 2 + 2 - 1
    });

    it("stops if the earlier checkout was paid in the meantime", async () => {
      await checkout();
      cartItems = [line(1)];
      kashia.getPaymentLink.mockResolvedValue({
        status: "completed",
        reference: "PL-1",
        escrow_id: "esc_1",
      });

      const second = await checkout();

      expect(second).toMatchObject({ failed: true, code: 409 });
      expect(second.description).toMatch(/has just been paid/);
      expect(orders.only().status).toBe(OrderStatus.PENDING);
      expect(products.stock(productId)).toBe(3);
    });

    it("does not hold the shopper's own stock twice when re-checking out the last units", async () => {
      products.products.get(String(productId))!.defaultVariation.quantity = 2;

      await checkout();
      const again = await checkout();

      expect(again).toMatchObject({ failed: false, code: 200 });
      expect(products.stock(productId)).toBe(0);
    });

    it("names the product and what is left when stock is short", async () => {
      cartItems = [line(6)];

      const result = await checkout();

      expect(result).toMatchObject({ failed: true, code: 409 });
      expect(result.description).toBe(
        'Only 5 of "Ankara Tote" left. Reduce the quantity in your cart and try again.',
      );
      expect(orders.orders.size).toBe(0);
      expect(products.stock(productId)).toBe(5);
    });

    it("rolls back earlier lines when a later line cannot be reserved", async () => {
      cartItems = [
        line(2),
        line(4, { productId: variedProductId, variationId }),
      ];

      const result = await checkout();

      expect(result.description).toBe(
        'Only 3 of "Sneakers" left. Reduce the quantity in your cart and try again.',
      );
      expect(products.stock(productId)).toBe(5);
      expect(products.stock(variedProductId, variationId)).toBe(3);
    });

    it("frees stock held by an abandoned unpaid order without a payment link", async () => {
      kashia.isConfigured.mockReturnValue(false);
      const stale = seedUnpaidOrder(45 * 60 * 1000, 4); // 1 left
      cartItems = [line(2)];

      const result = await checkout();

      expect(result).toMatchObject({ failed: false, code: 201 });
      expect(orders.orders.get(String(stale._id))).toMatchObject({
        status: OrderStatus.CANCELLED,
        stockReserved: false,
      });
      expect(products.stock(productId)).toBe(3); // 5 - 4 + 4 - 2
    });

    it("keeps a stale hold whose payment link is still open, until the maximum hold", async () => {
      const recent = seedUnpaidOrder(45 * 60 * 1000, 4, {
        paymentReference: "PL-OLD",
      });
      cartItems = [line(2)];

      const blocked = await checkout();
      expect(blocked).toMatchObject({ failed: true, code: 409 });
      expect(orders.orders.get(String(recent._id)).status).toBe(
        OrderStatus.PENDING_PAYMENT,
      );

      orders.orders.get(String(recent._id)).createdAt = new Date(
        Date.now() - PENDING_PAYMENT_MAX_HOLD_MS - 1000,
      );
      const allowed = await checkout();
      expect(allowed).toMatchObject({ failed: false, code: 201 });
      expect(orders.orders.get(String(recent._id)).status).toBe(
        OrderStatus.CANCELLED,
      );
    });

    it("confirms rather than cancels a stale order that turns out to be paid", async () => {
      const paid = seedUnpaidOrder(45 * 60 * 1000, 4, {
        paymentReference: "PL-OLD",
      });
      kashia.getPaymentLink.mockResolvedValue({
        status: "completed",
        escrow_id: "esc_9",
      });
      cartItems = [line(2)];

      const result = await checkout();

      expect(result).toMatchObject({ failed: true, code: 409 }); // the stock really is sold
      expect(orders.orders.get(String(paid._id)).status).toBe(
        OrderStatus.PENDING,
      );
      expect(products.stock(productId)).toBe(1);
    });

    it("returns the reservation if the order cannot be saved", async () => {
      orders.failNextCreate = true;

      const result = await checkout();

      expect(result).toMatchObject({ failed: true, code: 500 });
      expect(products.stock(productId)).toBe(5);
    });

    it("cancels the order and returns stock if the payment link cannot be created", async () => {
      kashia.createPaymentLink.mockRejectedValue(new Error("Kashia down"));

      const result = await checkout();

      expect(result).toMatchObject({ failed: true, code: 502 });
      expect(orders.only()).toMatchObject({
        status: OrderStatus.CANCELLED,
        stockReserved: false,
      });
      expect(products.stock(productId)).toBe(5);
    });

    it.each([
      [
        "an inactive product",
        () =>
          (products.products.get(String(productId))!.status =
            ProductStatus.INACTIVE),
        '"Ankara Tote" is no longer available. Remove it from your cart to continue.',
      ],
      [
        "a product from another store",
        () =>
          (products.products.get(String(productId))!.vendorId = otherVendorId),
        "Your cart has items from more than one store. Please review your cart.",
      ],
      [
        "a removed option",
        () =>
          (cartItems = [
            line(1, {
              productId: variedProductId,
              variationId: new Types.ObjectId(),
            }),
          ]),
        'The option you chose for "Sneakers" is no longer available. Please update your cart.',
      ],
      [
        "a fractional quantity",
        () => (cartItems = [line(1.5)]),
        "An item in your cart has an invalid quantity. Please update your cart.",
      ],
      [
        "a zero total",
        () => (cartItems = [line(1, { total: 0 })]),
        "Order total must be greater than zero.",
      ],
    ])("refuses a cart with %s", async (_label, arrange, message) => {
      arrange();

      const result = await checkout();

      expect(result).toMatchObject({
        failed: true,
        code: 400,
        description: message,
      });
      expect(products.stock(productId)).toBe(5);
      expect(orders.orders.size).toBe(0);
    });
  });

  describe("cancelling and status changes", () => {
    const placeAndPay = async () => {
      const placed = await checkout();
      await service.confirmOrderPayment(String(placed.data._id), {
        escrowId: "esc_1",
      });
      return String(placed.data._id);
    };

    it("returns stock exactly once when the shopper cancels twice at the same time", async () => {
      const placed = await checkout();
      const id = String(placed.data._id);

      const [a, b] = await Promise.all([
        service.cancelOrder(userId, id),
        service.cancelOrder(userId, id),
      ]);

      expect([a.code, b.code].sort()).toEqual([409, undefined]);
      expect(products.stock(productId)).toBe(5);
      expect(
        orders
          .only()
          .timeline.filter((t: Doc) => t.status === OrderStatus.CANCELLED),
      ).toHaveLength(1);
    });

    it("keeps stock consistent when a shopper cancel races the store accepting", async () => {
      const id = await placeAndPay();

      const [cancel, accept] = await Promise.all([
        service.cancelOrder(userId, id),
        service.updateOrderStatus(
          id,
          OrderStatus.ACCEPTED,
          "Accepted",
          "VENDOR",
          String(vendorId),
        ),
      ]);

      expect([cancel.failed, accept.failed].filter(Boolean)).toHaveLength(1);
      const order = orders.only();
      expect(products.stock(productId)).toBe(
        order.status === OrderStatus.CANCELLED ? 5 : 3,
      );
    });

    it("does not let the shopper cancel once the store has accepted", async () => {
      const id = await placeAndPay();
      await service.updateOrderStatus(
        id,
        OrderStatus.ACCEPTED,
        "Accepted",
        "VENDOR",
        String(vendorId),
      );

      const result = await service.cancelOrder(userId, id);

      expect(result).toMatchObject({ failed: true, code: 400 });
      expect(products.stock(productId)).toBe(3);
    });

    it("returns stock and flags a refund when the store rejects a paid order", async () => {
      const id = await placeAndPay();

      const result = await service.updateOrderStatus(
        id,
        OrderStatus.REJECTED,
        "Out of stock",
        "VENDOR",
        String(vendorId),
      );

      expect(result.failed).toBe(false);
      expect(products.stock(productId)).toBe(5);
      expect(String(logs.warn.mock.calls.at(-1)[0])).toMatch(
        /esc_1.*refund required/,
      );
      expect(orders.only().refunds).toEqual([
        expect.objectContaining({
          status: OrderRefundStatus.REQUIRED,
          reason: OrderRefundReason.ORDER_REJECTED,
          amount: 2000,
          escrowId: "esc_1",
          paymentReference: "PL-1",
        }),
      ]);
    });

    it("refuses a store update when the store is not identified", async () => {
      const id = await placeAndPay();

      await expect(
        service.updateOrderStatus(
          id,
          OrderStatus.ACCEPTED,
          "x",
          "VENDOR",
          undefined,
        ),
      ).resolves.toMatchObject({ failed: true, code: 403 });
    });

    it("does not let a store update another store's order", async () => {
      const id = await placeAndPay();

      await expect(
        service.updateOrderStatus(
          id,
          OrderStatus.ACCEPTED,
          "x",
          "VENDOR",
          String(otherVendorId),
        ),
      ).resolves.toMatchObject({ failed: true, code: 404 });
    });

    it("commits the reservation when an admin marks an unpaid order as paid", async () => {
      const placed = await checkout();

      await service.updateOrderStatus(
        String(placed.data._id),
        OrderStatus.PENDING,
        "Paid offline",
      );

      expect(orders.only()).toMatchObject({
        status: OrderStatus.PENDING,
        stockReserved: false,
        stockCommitted: true,
      });
    });
  });

  describe("payment links and payment events", () => {
    it("reuses the live link when the shopper presses Pay now again", async () => {
      const placed = await checkout();

      const result = await service.createOrderPaymentLink(
        userId,
        String(placed.data._id),
      );

      expect(result.failed).toBe(false);
      expect(result.data.paymentUrl).toBe("https://pay.example/PL-1");
      expect(kashia.createPaymentLink).toHaveBeenCalledTimes(1);
    });

    it("does not open a new link for an order that is already paid", async () => {
      const placed = await checkout();
      kashia.getPaymentLink.mockResolvedValue({
        status: "completed",
        escrow_id: "esc_1",
      });

      const result = await service.createOrderPaymentLink(
        userId,
        String(placed.data._id),
      );

      expect(result).toMatchObject({ failed: true, code: 409 });
      expect(kashia.createPaymentLink).toHaveBeenCalledTimes(1);
      expect(orders.only().status).toBe(OrderStatus.PENDING);
    });

    it("ignores the expiry of a link that is no longer the order's active link", async () => {
      const placed = await checkout();

      const result = await service.cancelPendingPaymentOrder(
        String(placed.data._id),
        "Payment link expired",
        { paymentReference: "PL-OLD", escrowStatus: "expired" },
      );

      expect(result.description).toBe(
        "Payment link is no longer the order's active link",
      );
      expect(orders.only().status).toBe(OrderStatus.PENDING_PAYMENT);
      expect(products.stock(productId)).toBe(3);
    });

    it("never both confirms and releases stock when payment and expiry race", async () => {
      const placed = await checkout();
      const id = String(placed.data._id);

      await Promise.all([
        service.confirmOrderPayment(id, {
          escrowId: "esc_1",
          paymentReference: "PL-1",
        }),
        service.cancelPendingPaymentOrder(id, "Payment link expired", {
          paymentReference: "PL-1",
          escrowStatus: "expired",
        }),
      ]);

      const order = orders.only();
      if (order.status === OrderStatus.PENDING) {
        expect(order).toMatchObject({
          stockCommitted: true,
          stockReserved: false,
        });
        expect(products.stock(productId)).toBe(3);
      } else {
        expect(order.status).toBe(OrderStatus.CANCELLED);
        expect(products.stock(productId)).toBe(5);
      }
    });

    it("reports a cancelled order as failed, not confirmed, on the payment return page", async () => {
      const placed = await checkout();
      await service.cancelOrder(userId, String(placed.data._id));

      const result = await service.verifyOrderPaymentPublic(
        String(placed.data._id),
      );

      expect(result.data.paymentStatus).toBe("failed");
    });

    it("flags a second, different payment for an order that is already paid", async () => {
      const placed = await checkout();
      const id = String(placed.data._id);
      await service.confirmOrderPayment(id, { escrowId: "esc_1" });

      const result = await service.confirmOrderPayment(id, {
        escrowId: "esc_2",
        paymentReference: "PL-2",
      });

      expect(result.description).toBe("Payment already confirmed");
      expect(String(logs.error.mock.calls.at(-1)[0])).toMatch(
        /Second payment .*esc_2.*already paid with escrow=esc_1.*refund required/,
      );
      const order = orders.only();
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.escrowId).toBe("esc_1");
      expect(order.refunds).toEqual([
        expect.objectContaining({
          status: OrderRefundStatus.REQUIRED,
          reason: OrderRefundReason.DUPLICATE_PAYMENT,
          escrowId: "esc_2",
          paymentReference: "PL-2",
        }),
      ]);
    });
  });

  describe("refunds owed to the shopper", () => {
    const place = async () => String((await checkout()).data._id);
    const pay = (id: string, escrow: Doc = { escrowId: "esc_1" }) =>
      service.confirmOrderPayment(id, { paymentReference: "PL-1", ...escrow });
    const refundsOf = (id: string): Doc[] =>
      orders.orders.get(id)!.refunds ?? [];
    const refundIdOf = (id: string, index = 0) =>
      String(refundsOf(id)[index]._id);
    const historyOf = (id: string, index = 0) =>
      (refundsOf(id)[index].history as Doc[]).map((e) => e.type);
    const evidence = (overrides: Doc = {}) => ({
      method: OrderRefundPayoutMethod.BANK_TRANSFER,
      reference: "FT-0001",
      amount: 2000,
      ...overrides,
    });
    const complete = (id: string, overrides: Doc = {}, admin = "admin-1") =>
      service.completeOrderRefund(
        id,
        refundIdOf(id),
        admin,
        evidence(overrides) as any,
      );
    /** A paid order, cancelled, so it owes one refund for esc_1. */
    const owingOrder = async (escrowId = "esc_1") => {
      const id = await place();
      await pay(id, { escrowId });
      await service.cancelOrder(userId, id);
      return id;
    };
    const ticks = async (n: number) => {
      for (let i = 0; i < n; i++) await tick();
    };

    describe("opening", () => {
      it("records a refund, with its opening in the history, when the shopper cancels a paid order", async () => {
        const id = await owingOrder();

        expect(refundsOf(id)).toEqual([
          expect.objectContaining({
            status: OrderRefundStatus.REQUIRED,
            reason: OrderRefundReason.ORDER_CANCELLED,
            amount: 2000,
            escrowId: "esc_1",
          }),
        ]);
        expect(historyOf(id)).toEqual([OrderRefundEventType.OPENED]);
      });

      it("records no refund when an unpaid order is cancelled", async () => {
        const id = await place();

        await service.cancelOrder(userId, id);

        expect(orders.only().status).toBe(OrderStatus.CANCELLED);
        expect(refundsOf(id)).toEqual([]);
      });

      it("records no refund for an order that never had a payment attached", async () => {
        kashia.isConfigured.mockReturnValue(false); // no payment link
        const id = await place();
        orders.orders.get(id)!.status = OrderStatus.PENDING; // legacy order

        await service.updateOrderStatus(id, OrderStatus.CANCELLED, "Cancelled");

        expect(refundsOf(id)).toEqual([]);
        expect(String(logs.warn.mock.calls.at(-1)[0])).toMatch(
          /no payment on record; check manually/,
        );
      });

      it("records exactly one refund when the shopper and an admin cancel a paid order at once", async () => {
        const id = await place();
        await pay(id);

        await Promise.all([
          service.cancelOrder(userId, id),
          service.updateOrderStatus(id, OrderStatus.CANCELLED, "Admin cancel"),
        ]);

        expect(refundsOf(id)).toHaveLength(1);
      });

      it("records a refund for a payment that lands after the order was cancelled, once per escrow", async () => {
        const id = await place();
        await service.cancelOrder(userId, id);

        const first = await pay(id, {
          escrowId: "esc_late",
          amountKobo: 200000,
        });
        await pay(id, { escrowId: "esc_late", amountKobo: 200000 }); // redelivered

        expect(first).toMatchObject({ failed: true, code: 409 });
        expect(refundsOf(id)).toEqual([
          expect.objectContaining({
            status: OrderRefundStatus.REQUIRED,
            reason: OrderRefundReason.PAID_AFTER_CANCELLATION,
            amount: 2000,
            escrowId: "esc_late",
            paymentReference: "PL-1",
          }),
        ]);
      });

      it("does not open a second refund when the escrow id arrives after a refund opened without it", async () => {
        const id = await place();
        // Confirmed from the return page, whose payment link lacked an escrow id.
        await pay(id, { escrowId: undefined });
        await service.cancelOrder(userId, id);
        expect(refundsOf(id)[0].escrowId).toBeUndefined();

        // The escrow.active webhook for that same payment arrives late.
        await pay(id, { escrowId: "esc_1" });

        expect(refundsOf(id)).toEqual([
          expect.objectContaining({
            reason: OrderRefundReason.ORDER_CANCELLED,
            escrowId: "esc_1",
          }),
        ]);
      });

      it("refuses to cancel if the order's escrow changed after it was read, rather than refund the wrong escrow", async () => {
        const id = await place();
        await pay(id);
        const transition = orders.transitionStatus.bind(orders);
        jest
          .spyOn(orders, "transitionStatus")
          .mockImplementationOnce(async (...args: any[]) => {
            orders.orders.get(id)!.escrowId = "esc_changed"; // lands mid-cancel
            return (transition as any)(...args);
          });

        const result = await service.cancelOrder(userId, id);

        expect(result).toMatchObject({ failed: true, code: 409 });
        expect(orders.only().status).toBe(OrderStatus.PENDING);
        expect(refundsOf(id)).toEqual([]);
        expect(products.stock(productId)).toBe(3); // nothing released
      });
    });

    describe("Kashia reporting a refund", () => {
      it("closes the refund owed for that escrow", async () => {
        const id = await owingOrder();

        const first = await service.recordEscrowRefunded(id, {
          escrowId: "esc_1",
        });
        const again = await service.recordEscrowRefunded(id, {
          escrowId: "esc_1",
        });

        expect([first, again]).toEqual(["completed", "unmatched"]);
        expect(refundsOf(id)).toEqual([
          expect.objectContaining({
            status: OrderRefundStatus.REFUNDED,
            resolvedBy: OrderRefundResolution.KASHIA,
            providerConfirmedAt: expect.any(Date),
          }),
        ]);
        expect(historyOf(id)).toEqual([
          OrderRefundEventType.OPENED,
          OrderRefundEventType.COMPLETED,
        ]);
      });

      it("matches by payment reference a refund opened without an escrow id, and records the id", async () => {
        const id = await place();
        await pay(id, { escrowId: undefined });
        await service.cancelOrder(userId, id);

        const outcome = await service.recordEscrowRefunded(id, {
          escrowId: "esc_9",
          paymentReference: "PL-1",
        });

        expect(outcome).toBe("completed");
        expect(refundsOf(id)[0]).toMatchObject({
          status: OrderRefundStatus.REFUNDED,
          escrowId: "esc_9",
        });
      });

      it("leaves a refund for a different escrow open", async () => {
        const id = await owingOrder();

        const outcome = await service.recordEscrowRefunded(id, {
          escrowId: "esc_other",
        });

        expect(outcome).toBe("unmatched");
        expect(refundsOf(id)[0].status).toBe(OrderRefundStatus.REQUIRED);
      });

      it("closes a refund opened AFTER Kashia's report (payment report delivered late)", async () => {
        const id = await place();
        await service.cancelOrder(userId, id);

        await service.recordEscrowRefunded(id, {
          escrowId: "esc_late",
          paymentReference: "PL-1",
        });
        await pay(id, { escrowId: "esc_late" });

        expect(refundsOf(id)).toEqual([
          expect.objectContaining({
            reason: OrderRefundReason.PAID_AFTER_CANCELLATION,
            status: OrderRefundStatus.REFUNDED,
            resolvedBy: OrderRefundResolution.KASHIA,
          }),
        ]);
      });

      it("closes the refund when Kashia refunded the escrow before the paid order was cancelled", async () => {
        const id = await place();
        await pay(id);
        await service.recordEscrowRefunded(id, { escrowId: "esc_1" });

        await service.cancelOrder(userId, id);

        expect(refundsOf(id)[0]).toMatchObject({
          status: OrderRefundStatus.REFUNDED,
          resolvedBy: OrderRefundResolution.KASHIA,
        });
      });

      // Positive: the refund report is held back that many steps; negative:
      // the other side is. Covers each arriving first and every interleaving.
      const RACE_OFFSETS = [-8, -6, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
      const race = <A, B>(
        offset: number,
        refundReport: () => Promise<A>,
        other: () => Promise<B>,
      ) =>
        Promise.all([
          ticks(Math.max(offset, 0)).then(refundReport),
          ticks(Math.max(-offset, 0)).then(other),
        ]);

      it.each(RACE_OFFSETS)(
        "never leaves a refund owed when the refund and payment reports race (offset %i)",
        async (offset) => {
          const id = await place();
          await service.cancelOrder(userId, id);

          await race(
            offset,
            () => service.recordEscrowRefunded(id, { escrowId: "esc_late" }),
            () => pay(id, { escrowId: "esc_late" }),
          );

          expect(refundsOf(id)).toEqual([
            expect.objectContaining({ status: OrderRefundStatus.REFUNDED }),
          ]);
        },
      );

      it.each(RACE_OFFSETS)(
        "never leaves a refund owed when the refund report races the cancellation (offset %i)",
        async (offset) => {
          const id = await place();
          await pay(id);

          await race(
            offset,
            () => service.recordEscrowRefunded(id, { escrowId: "esc_1" }),
            () => service.cancelOrder(userId, id),
          );

          expect(refundsOf(id)).toEqual([
            expect.objectContaining({ status: OrderRefundStatus.REFUNDED }),
          ]);
        },
      );
    });

    describe("completing a refund by hand", () => {
      it("records the payout evidence, keeps it in the history and emails the shopper the reference", async () => {
        usersRepository.query.mockResolvedValue({
          email: "ada@example.com",
          firstName: "Ada",
        });
        const id = await owingOrder();

        const result = await complete(id, {
          reference: "  FT-0001  ",
          note: "  To your GTBank account  ",
        });

        expect(result).toMatchObject({
          failed: false,
          description: "Refund marked as completed",
        });
        expect(refundsOf(id)[0]).toMatchObject({
          status: OrderRefundStatus.REFUNDED,
          resolvedBy: OrderRefundResolution.ADMIN,
          resolvedByAdminId: "admin-1",
          payout: {
            method: OrderRefundPayoutMethod.BANK_TRANSFER,
            reference: "FT-0001",
            referenceKey: "FT-0001",
            amount: 2000,
          },
          note: "To your GTBank account",
        });
        expect(refundsOf(id)[0].history.at(-1)).toMatchObject({
          type: OrderRefundEventType.COMPLETED,
          actor: OrderRefundActor.ADMIN,
          actorId: "admin-1",
          payout: { reference: "FT-0001", amount: 2000 },
        });
        expect(emailService.sendSafe).toHaveBeenCalledWith(
          expect.objectContaining({
            to: "ada@example.com",
            template: EmailTemplate.REFUND_SENT,
            data: expect.objectContaining({
              amount: 2000,
              reference: "FT-0001",
              methodLabel: "Bank transfer",
            }),
          }),
        );
      });

      it("refuses an amount that does not match the refund", async () => {
        const id = await owingOrder();

        const result = await complete(id, { amount: 200 });

        expect(result).toMatchObject({ failed: true, code: 400 });
        expect(refundsOf(id)[0].status).toBe(OrderRefundStatus.REQUIRED);
        expect(payoutRefs.claims.size).toBe(0);
      });

      it("does not let one payout reference close two refunds, however it is typed", async () => {
        const a = await owingOrder("esc_a");
        cartItems = [line(2)];
        const b = await owingOrder("esc_b");

        const first = await complete(a, { reference: "ft 0001/ab" });
        const second = await complete(b, { reference: "FT0001/AB" });

        expect(first.failed).toBe(false);
        expect(second).toMatchObject({ failed: true, code: 409 });
        expect(second.description).toMatch(
          /already recorded against another refund/,
        );
        expect(refundsOf(b)[0].status).toBe(OrderRefundStatus.REQUIRED);
      });

      it("lets only one of two admins use the same reference at the same moment", async () => {
        const a = await owingOrder("esc_a");
        const b = await owingOrder("esc_b");

        const results = await Promise.all([
          complete(a, {}, "admin-1"),
          complete(b, {}, "admin-2"),
        ]);

        expect(results.filter((r) => !r.failed)).toHaveLength(1);
        const statuses = [refundsOf(a)[0].status, refundsOf(b)[0].status];
        expect(statuses.sort()).toEqual([
          OrderRefundStatus.REFUNDED,
          OrderRefundStatus.REQUIRED,
        ]);
      });

      it("lets only one of two admins complete the same refund, and frees the loser's reference", async () => {
        const id = await owingOrder();

        const results = await Promise.all([
          complete(id, { reference: "FT-AAAA" }, "admin-1"),
          complete(id, { reference: "FT-BBBB" }, "admin-2"),
        ]);

        expect(results.filter((r) => !r.failed)).toHaveLength(1);
        expect(
          historyOf(id).filter((t) => t === OrderRefundEventType.COMPLETED),
        ).toHaveLength(1);
        const kept = refundsOf(id)[0].payout.referenceKey;
        expect([...payoutRefs.claims.keys()]).toEqual([kept]);
      });

      it("reports a refund Kashia closed first as already completed, and frees the reference", async () => {
        const id = await owingOrder();
        await service.recordEscrowRefunded(id, { escrowId: "esc_1" });

        const result = await complete(id);

        expect(result).toMatchObject({ failed: true, code: 409 });
        expect(payoutRefs.claims.size).toBe(0);
      });

      it.each([-4, -2, -1, 0, 1, 2, 3, 4, 5, 6, 8, 10])(
        "stays consistent when Kashia's refund report races an admin completion (offset %i)",
        async (offset) => {
          const id = await owingOrder();

          const [outcome, manual] = await Promise.all([
            ticks(Math.max(offset, 0)).then(() =>
              service.recordEscrowRefunded(id, { escrowId: "esc_1" }),
            ),
            ticks(Math.max(-offset, 0)).then(() => complete(id)),
          ]);

          const refund = refundsOf(id)[0];
          expect(refund.status).toBe(OrderRefundStatus.REFUNDED);
          expect(
            historyOf(id).filter((t) => t === OrderRefundEventType.COMPLETED),
          ).toHaveLength(1);
          if (manual.failed) {
            // Kashia got there first.
            expect(outcome).toBe("completed");
            expect(payoutRefs.claims.size).toBe(0);
          } else {
            // The admin paid by bank transfer and Kashia refunded as well.
            expect(outcome).toBe("possible_double_refund");
            expect(refund.history.at(-1)).toMatchObject({
              type: OrderRefundEventType.PROVIDER_REFUNDED,
              possibleDoubleRefund: true,
            });
          }
        },
      );

      it("reports an unknown order or refund as not found, and a finished refund as completed", async () => {
        const id = await owingOrder();
        await complete(id);

        await expect(
          service.completeOrderRefund(
            String(new Types.ObjectId()),
            String(new Types.ObjectId()),
            "admin-1",
            evidence() as any,
          ),
        ).resolves.toMatchObject({
          failed: true,
          code: 404,
          description: "Order not found",
        });
        await expect(
          service.completeOrderRefund(
            id,
            String(new Types.ObjectId()),
            "admin-1",
            evidence() as any,
          ),
        ).resolves.toMatchObject({
          failed: true,
          code: 404,
          description: "Refund not found on this order",
        });
        await expect(
          complete(id, { reference: "FT-9999" }),
        ).resolves.toMatchObject({ failed: true, code: 409 });
      });
    });

    describe("a completion that did not really pay the shopper", () => {
      it("flags a likely double refund when Kashia refunds money an admin paid back by bank transfer", async () => {
        const id = await owingOrder();
        await complete(id);
        logs.error.mockClear();

        const outcome = await service.recordEscrowRefunded(id, {
          escrowId: "esc_1",
        });
        const again = await service.recordEscrowRefunded(id, {
          escrowId: "esc_1",
        });

        expect([outcome, again]).toEqual([
          "possible_double_refund",
          "unmatched",
        ]);
        expect(refundsOf(id)[0].history.at(-1)).toMatchObject({
          type: OrderRefundEventType.PROVIDER_REFUNDED,
          possibleDoubleRefund: true,
        });
        expect(logs.error).toHaveBeenCalledTimes(1);
        expect(String(logs.error.mock.calls[0][0])).toMatch(
          /Possible double refund .*FT-0001/,
        );
      });

      it("treats Kashia's report as confirmation when the admin refunded through Kashia", async () => {
        const id = await owingOrder();
        await complete(id, { method: OrderRefundPayoutMethod.KASHIA });

        const outcome = await service.recordEscrowRefunded(id, {
          escrowId: "esc_1",
        });

        expect(outcome).toBe("confirmed");
        expect(refundsOf(id)[0]).toMatchObject({
          providerConfirmedAt: expect.any(Date),
        });
        expect(refundsOf(id)[0].history.at(-1).possibleDoubleRefund).toBe(
          false,
        );
      });

      it("lets an admin reopen a mistaken completion; the completion stays in the history and the reference is freed", async () => {
        const id = await owingOrder();
        await complete(id, { reference: "FT-WRONG" });

        const result = await service.reopenOrderRefund(
          id,
          refundIdOf(id),
          "admin-2",
          "  Transfer FT-WRONG was for another order  ",
        );

        expect(result).toMatchObject({ failed: false });
        const refund = refundsOf(id)[0];
        expect(refund.status).toBe(OrderRefundStatus.REQUIRED);
        expect(refund.payout).toBeUndefined();
        expect(refund.resolvedBy).toBeUndefined();
        expect(historyOf(id)).toEqual([
          OrderRefundEventType.OPENED,
          OrderRefundEventType.COMPLETED,
          OrderRefundEventType.REOPENED,
        ]);
        expect(refund.history.at(-1)).toMatchObject({
          actor: OrderRefundActor.ADMIN,
          actorId: "admin-2",
          reason: "Transfer FT-WRONG was for another order",
        });
        expect(payoutRefs.claims.size).toBe(0);

        // It can then be completed properly, even reusing the freed reference.
        await expect(
          complete(id, { reference: "FT-WRONG" }),
        ).resolves.toMatchObject({ failed: false });
      });

      it.each([0, 1, 2, 3, 4, 5, 6, 8])(
        "keeps the reference claimed when a refund is reopened and re-recorded with it at once (offset %i)",
        async (offset) => {
          const id = await owingOrder();
          await complete(id, { reference: "FT-SAME" });
          // A slow network call freeing the reference widens the window in
          // which the refund can be re-recorded before the release lands.
          const release = payoutRefs.release.bind(payoutRefs);
          jest
            .spyOn(payoutRefs, "release")
            .mockImplementation(
              async (...args: [string, unknown, unknown, unknown]) => {
                await ticks(6);
                return release(...args);
              },
            );

          await Promise.all([
            service.reopenOrderRefund(id, refundIdOf(id), "admin-1", "Recheck"),
            ticks(offset).then(() => complete(id, { reference: "FT-SAME" })),
          ]);

          // Whatever the interleaving: a refund recorded with the reference
          // holds the claim, so no other refund can reuse it.
          const refund = refundsOf(id)[0];
          const claimed = payoutRefs.claims.has("FT-SAME");
          expect(claimed).toBe(refund.status === OrderRefundStatus.REFUNDED);
        },
      );

      it("lets the shopper report a refund as not received, putting it back in the queue", async () => {
        const id = await owingOrder();
        await complete(id);

        const result = await service.reportRefundNotReceived(
          userId,
          id,
          refundIdOf(id),
        );

        expect(result).toMatchObject({ failed: false });
        expect(refundsOf(id)[0].status).toBe(OrderRefundStatus.REQUIRED);
        expect(refundsOf(id)[0].history.at(-1)).toMatchObject({
          type: OrderRefundEventType.REOPENED,
          actor: OrderRefundActor.SHOPPER,
          actorId: userId,
        });
        // The earlier payout is still there for the admin to check.
        expect(refundsOf(id)[0].history[1]).toMatchObject({
          type: OrderRefundEventType.COMPLETED,
          payout: { reference: "FT-0001" },
        });
      });

      it("does not let another shopper report someone else's refund", async () => {
        const id = await owingOrder();
        await complete(id);

        const result = await service.reportRefundNotReceived(
          otherUserId,
          id,
          refundIdOf(id),
        );

        expect(result).toMatchObject({ failed: true, code: 404 });
        expect(refundsOf(id)[0].status).toBe(OrderRefundStatus.REFUNDED);
      });

      it("only accepts a report within the reporting window", async () => {
        const id = await owingOrder();
        await complete(id);
        refundsOf(id)[0].refundedAt = new Date(
          Date.now() - 31 * 24 * 3600 * 1000,
        );

        const result = await service.reportRefundNotReceived(
          userId,
          id,
          refundIdOf(id),
        );

        expect(result).toMatchObject({ failed: true, code: 409 });
        expect(result.description).toMatch(/contact support/);
        expect(refundsOf(id)[0].status).toBe(OrderRefundStatus.REFUNDED);
      });

      it("does not reopen a refund Kashia confirmed, nor one still in progress", async () => {
        const confirmed = await owingOrder();
        await service.recordEscrowRefunded(confirmed, { escrowId: "esc_1" });
        const open = await owingOrder("esc_2");

        const byShopper = await service.reportRefundNotReceived(
          userId,
          confirmed,
          refundIdOf(confirmed),
        );
        const byAdmin = await service.reopenOrderRefund(
          confirmed,
          refundIdOf(confirmed),
          "admin-1",
          "Checking",
        );
        const stillOpen = await service.reopenOrderRefund(
          open,
          refundIdOf(open),
          "admin-1",
          "Checking",
        );

        expect(byShopper).toMatchObject({ failed: true, code: 409 });
        expect(byShopper.description).toMatch(/Kashia confirmed/);
        expect(byAdmin).toMatchObject({ failed: true, code: 409 });
        expect(stillOpen).toMatchObject({
          failed: true,
          code: 409,
          description: "This refund is still in progress",
        });
      });

      it("lets only one of a shopper report and an admin reopen apply", async () => {
        const id = await owingOrder();
        await complete(id);

        const results = await Promise.all([
          service.reportRefundNotReceived(userId, id, refundIdOf(id)),
          service.reopenOrderRefund(id, refundIdOf(id), "admin-1", "Mistake"),
        ]);

        expect(results.filter((r) => !r.failed)).toHaveLength(1);
        expect(
          historyOf(id).filter((t) => t === OrderRefundEventType.REOPENED),
        ).toHaveLength(1);
      });
    });
  });

  describe("escrow events driving the order", () => {
    let webhooks: KashiaWebhookService;
    let delivery = 0;
    const deliver = (
      event: string,
      orderId: string,
      data: Doc = {},
      timestamp: string | undefined = new Date().toISOString(),
    ) =>
      webhooks.processEvent({
        event,
        webhook_id: `wh_${++delivery}`,
        timestamp: timestamp as string,
        data: {
          id: "esc_1",
          reference: "PL-1",
          metadata: { orderId },
          ...data,
        },
      });
    const order = () => orders.only();
    const alertsOf = (): Doc[] => order().paymentAlerts ?? [];
    const asVendor = (id: string, status: OrderStatus) =>
      service.updateOrderStatus(
        id,
        status,
        "by store",
        "VENDOR",
        String(vendorId),
      );
    const place = async () => String((await checkout()).data._id);
    const paid = async (escrow: Doc = { escrowId: "esc_1" }) => {
      const id = await place();
      await service.confirmOrderPayment(id, {
        paymentReference: "PL-1",
        ...escrow,
      });
      return id;
    };
    const shipped = async () => {
      const id = await paid();
      await asVendor(id, OrderStatus.ACCEPTED);
      await asVendor(id, OrderStatus.SHIPPED);
      return id;
    };
    const ticks = async (n: number) => {
      for (let i = 0; i < n; i++) await tick();
    };

    beforeEach(() => {
      const eventsRepository = {
        claim: jest.fn().mockResolvedValue({ claimed: true, attempt: 1 }),
        markProcessed: jest.fn().mockResolvedValue(undefined),
        markFailed: jest.fn().mockResolvedValue(undefined),
      };
      webhooks = new KashiaWebhookService(
        eventsRepository as unknown as KashiaWebhookEventsRepository,
        service,
      );
    });

    describe("refunded", () => {
      it.each([OrderStatus.PENDING, OrderStatus.ACCEPTED])(
        "cancels a paid %s order, returns its stock and closes its refund, so the store cannot ship it",
        async (status) => {
          const id = await paid();
          if (status === OrderStatus.ACCEPTED) {
            await asVendor(id, OrderStatus.ACCEPTED);
          }

          await deliver("escrow.refunded", id, { status: "refunded" });

          expect(order()).toMatchObject({
            status: OrderStatus.CANCELLED,
            escrowStatus: "refunded",
          });
          expect(products.stock(productId)).toBe(5);
          expect(order().refunds).toEqual([
            expect.objectContaining({
              status: OrderRefundStatus.REFUNDED,
              resolvedBy: OrderRefundResolution.KASHIA,
            }),
          ]);
          await expect(
            asVendor(id, OrderStatus.SHIPPED),
          ).resolves.toMatchObject({ failed: true });
        },
      );

      it("tells the shopper", async () => {
        usersRepository.query.mockResolvedValue({
          email: "ada@example.com",
          firstName: "Ada",
        });
        const id = await paid();
        emailService.sendSafe.mockClear();

        await deliver("escrow.refunded", id);

        expect(emailService.sendSafe).toHaveBeenCalledWith(
          expect.objectContaining({
            template: EmailTemplate.ORDER_STATUS_UPDATE,
            data: expect.objectContaining({ status: OrderStatus.CANCELLED }),
          }),
        );
      });

      it("raises an alert instead when the order was already shipped, once", async () => {
        const id = await shipped();

        await deliver("escrow.refunded", id);
        await deliver("escrow.refunded", id); // redelivered under a new id

        expect(order().status).toBe(OrderStatus.SHIPPED);
        expect(alertsOf()).toEqual([
          expect.objectContaining({
            type: OrderPaymentAlertType.ESCROW_REVERSED_AFTER_SHIPPING,
            escrowId: "esc_1",
            orderStatus: OrderStatus.SHIPPED,
          }),
        ]);
      });

      it("cancels an unpaid order when the refund report arrives before the payment report", async () => {
        const id = await place();

        await deliver("escrow.refunded", id);
        const late = await deliver("escrow.active", id, { amount: 200000 });

        expect(order().status).toBe(OrderStatus.CANCELLED);
        expect(order().stockCommitted).toBe(false);
        expect(products.stock(productId)).toBe(5);
        // Money already back with the shopper: nothing left to refund.
        expect(
          (order().refunds ?? []).filter(
            (r: Doc) => r.status === OrderRefundStatus.REQUIRED,
          ),
        ).toEqual([]);
        expect(late.outcome).toMatch(/not confirmed/);
      });

      it.each([-8, -6, -4, -3, -2, -1, 0, 1, 2, 3, 4, 6, 8])(
        "never leaves an order confirmed for money Kashia returned, however the reports race (offset %i)",
        async (offset) => {
          const id = await place();

          await Promise.all([
            ticks(Math.max(offset, 0)).then(() =>
              deliver("escrow.refunded", id),
            ),
            ticks(Math.max(-offset, 0)).then(() =>
              deliver("escrow.active", id, { amount: 200000 }),
            ),
          ]);

          expect(order().status).toBe(OrderStatus.CANCELLED);
          expect(products.stock(productId)).toBe(5);
          expect(
            (order().refunds ?? []).filter(
              (r: Doc) => r.status === OrderRefundStatus.REQUIRED,
            ),
          ).toEqual([]);
        },
      );

      // A refund report Kashia sends without the payment reference cannot be
      // tied to an order that does not know its escrow id yet. Only the
      // confirmation itself can then notice the money went back.
      const unmatchableRefund = (id: string) =>
        deliver("escrow.refunded", id, { reference: undefined });

      it("does not confirm a payment whose refund report could not be matched to the order", async () => {
        const id = await place();

        await unmatchableRefund(id);
        expect(order().status).toBe(OrderStatus.PENDING_PAYMENT);
        await deliver("escrow.active", id, { amount: 200000 });

        expect(order().status).toBe(OrderStatus.CANCELLED);
        expect(products.stock(productId)).toBe(5);
      });

      it.each([-6, -4, -3, -2, -1, 0, 1, 2, 3, 4])(
        "does not confirm it when that report races the payment report either (offset %i)",
        async (offset) => {
          const id = await place();

          await Promise.all([
            ticks(Math.max(offset, 0)).then(() => unmatchableRefund(id)),
            ticks(Math.max(-offset, 0)).then(() =>
              deliver("escrow.active", id, { amount: 200000 }),
            ),
          ]);

          // Either the payment was confirmed before Kashia's report (then
          // that report, now matchable, cancelled it) or it was refused.
          expect(order().status).toBe(OrderStatus.CANCELLED);
          expect(products.stock(productId)).toBe(5);
        },
      );

      it.each([0, 1, 2, 3, 4, 5, 6, 8])(
        "does not confirm it when the report lands between the confirmation's read and its slow write (offset %i)",
        async (offset) => {
          const id = await place();
          // A slow write to the database: the report can land after the
          // confirmation read the order but before it wrote.
          const transition = orders.transitionStatus.bind(orders);
          jest
            .spyOn(orders, "transitionStatus")
            .mockImplementation(async (...args: any[]) => {
              if (args[1] === OrderStatus.PENDING_PAYMENT) await ticks(10);
              return (transition as any)(...args);
            });

          await Promise.all([
            ticks(offset).then(() => unmatchableRefund(id)),
            deliver("escrow.active", id, { amount: 200000 }),
          ]);

          expect(order().status).toBe(OrderStatus.CANCELLED);
          expect(products.stock(productId)).toBe(5);
        },
      );

      it.each([-4, -2, -1, 0, 1, 2, 4, 6])(
        "ends cancelled when the refund report races the store accepting (offset %i)",
        async (offset) => {
          const id = await paid();

          await Promise.all([
            ticks(Math.max(offset, 0)).then(() =>
              deliver("escrow.refunded", id),
            ),
            ticks(Math.max(-offset, 0)).then(() =>
              asVendor(id, OrderStatus.ACCEPTED),
            ),
          ]);

          expect(order().status).toBe(OrderStatus.CANCELLED);
          expect(products.stock(productId)).toBe(5);
          expect(order().refunds).toEqual([
            expect.objectContaining({ status: OrderRefundStatus.REFUNDED }),
          ]);
        },
      );

      it("does not cancel the order for a refund of a duplicate payment", async () => {
        const id = await paid();
        await service.confirmOrderPayment(id, {
          escrowId: "esc_dup",
          paymentReference: "PL-2",
        });

        await deliver("escrow.refunded", id, {
          id: "esc_dup",
          reference: "PL-2",
        });

        expect(order()).toMatchObject({
          status: OrderStatus.PENDING,
          escrowId: "esc_1",
        });
        expect(order().escrowStatus).not.toBe("refunded");
        expect(order().refunds).toEqual([
          expect.objectContaining({
            reason: OrderRefundReason.DUPLICATE_PAYMENT,
            escrowId: "esc_dup",
            status: OrderRefundStatus.REFUNDED,
          }),
        ]);
      });
    });

    describe("cancelled", () => {
      it("stops fulfilment of a paid order but keeps the refund owed and asks an admin to check", async () => {
        const id = await paid();

        await deliver("escrow.cancelled", id);

        expect(order().status).toBe(OrderStatus.CANCELLED);
        expect(products.stock(productId)).toBe(5);
        expect(order().refunds).toEqual([
          expect.objectContaining({ status: OrderRefundStatus.REQUIRED }),
        ]);
        expect(alertsOf()).toEqual([
          expect.objectContaining({
            type: OrderPaymentAlertType.ESCROW_CANCELLED_AFTER_PAYMENT,
          }),
        ]);
      });

      it("leaves an unpaid order alone", async () => {
        const id = await place();

        await deliver("escrow.cancelled", id);

        expect(order().status).toBe(OrderStatus.PENDING_PAYMENT);
        expect(alertsOf()).toEqual([]);
      });

      it("asks an admin to check before refunding a cancelled order whose escrow Kashia cancelled", async () => {
        const id = await paid();
        await service.cancelOrder(userId, id);

        await deliver("escrow.cancelled", id);

        expect(alertsOf()).toEqual([
          expect.objectContaining({
            type: OrderPaymentAlertType.ESCROW_CANCELLED_AFTER_PAYMENT,
            orderStatus: OrderStatus.CANCELLED,
          }),
        ]);
      });
    });

    describe("completed", () => {
      it("delivers a shipped order", async () => {
        const id = await shipped();

        await deliver("escrow.completed", id);

        expect(order()).toMatchObject({
          status: OrderStatus.DELIVERED,
          escrowStatus: "completed",
        });
        expect(order().timeline.at(-1).description).toMatch(/Kashia/);
      });

      it.each([-4, -2, -1, 0, 1, 2, 4])(
        "delivers once when Kashia's completion races the shopper confirming delivery (offset %i)",
        async (offset) => {
          const id = await shipped();

          await Promise.all([
            ticks(Math.max(offset, 0)).then(() =>
              deliver("escrow.completed", id),
            ),
            ticks(Math.max(-offset, 0)).then(() =>
              service.confirmOrderDelivery(userId, id),
            ),
          ]);

          expect(order().status).toBe(OrderStatus.DELIVERED);
          expect(
            order().timeline.filter(
              (t: Doc) => t.status === OrderStatus.DELIVERED,
            ),
          ).toHaveLength(1);
        },
      );

      it("flags money released to the store for a cancelled order, and keeps the shopper's refund owed", async () => {
        const id = await paid();
        await service.cancelOrder(userId, id);

        const result = await deliver("escrow.completed", id);

        expect(result.outcome).toMatch(
          /ESCROW_RELEASED_FOR_CANCELLED_ORDER raised/,
        );
        expect(order().status).toBe(OrderStatus.CANCELLED);
        expect(order().refunds[0].status).toBe(OrderRefundStatus.REQUIRED);
        expect(logs.error).toHaveBeenCalledWith(
          expect.stringMatching(/ESCROW_RELEASED_FOR_CANCELLED_ORDER/),
        );
      });

      it("flags money released before the order was shipped", async () => {
        const id = await paid();

        await deliver("escrow.completed", id);

        expect(order().status).toBe(OrderStatus.PENDING);
        expect(alertsOf()[0].type).toBe(
          OrderPaymentAlertType.ESCROW_RELEASED_BEFORE_SHIPPING,
        );
      });

      it("flags a duplicate payment released to the store without touching the order's escrow", async () => {
        const id = await paid();
        await service.confirmOrderPayment(id, {
          escrowId: "esc_dup",
          paymentReference: "PL-2",
        });

        const before = order().escrowStatus;

        await deliver("escrow.completed", id, {
          id: "esc_dup",
          reference: "PL-2",
        });

        expect(order()).toMatchObject({
          status: OrderStatus.PENDING,
          escrowId: "esc_1",
          escrowStatus: before, // the duplicate's status is not mirrored
        });
        expect(alertsOf()).toEqual([
          expect.objectContaining({
            type: OrderPaymentAlertType.OTHER_ESCROW_RELEASED,
            escrowId: "esc_dup",
          }),
        ]);
      });
    });

    describe("out-of-order and foreign events", () => {
      it("ignores an event older than the status already applied", async () => {
        const id = await shipped();

        await deliver("escrow.completed", id, {}, "2026-01-02T00:00:00Z");
        const late = await deliver(
          "escrow.awaiting_confirmation",
          id,
          {},
          "2026-01-01T00:00:00Z",
        );

        expect(late.outcome).toMatch(/stale/);
        expect(order().escrowStatus).toBe("completed");
      });

      it("never reverts a final status, even without event times", async () => {
        const id = await shipped();

        await deliver("escrow.completed", id, {}, undefined);
        await deliver("escrow.disputed", id, {}, undefined);

        expect(order().escrowStatus).toBe("completed");
        expect(alertsOf()).toEqual([]);
      });

      it("applies a redelivered event's effects again if they did not happen the first time", async () => {
        const id = await shipped();
        const transition = orders.transitionStatus.bind(orders);
        jest
          .spyOn(orders, "transitionStatus")
          .mockRejectedValueOnce(new Error("db blip"));

        await expect(deliver("escrow.completed", id)).rejects.toThrow(
          "db blip",
        );
        expect(order().escrowStatus).toBe("completed"); // mirrored already
        expect(order().status).toBe(OrderStatus.SHIPPED);

        (orders.transitionStatus as jest.Mock).mockImplementation(transition);
        await deliver("escrow.completed", id);

        expect(order().status).toBe(OrderStatus.DELIVERED);
      });

      it("adopts the escrow of an order confirmed without one, when paid through its own link", async () => {
        const id = await paid({ escrowId: undefined });
        await asVendor(id, OrderStatus.ACCEPTED);
        await asVendor(id, OrderStatus.SHIPPED);

        await deliver("escrow.completed", id, { id: "esc_9" });

        expect(order()).toMatchObject({
          escrowId: "esc_9",
          status: OrderStatus.DELIVERED,
        });
      });

      it("does not adopt an escrow paid through another link", async () => {
        const id = await paid({ escrowId: undefined });

        await deliver("escrow.refunded", id, {
          id: "esc_x",
          reference: "PL-OTHER",
        });

        expect(order().escrowId).toBeUndefined();
        expect(order().status).toBe(OrderStatus.PENDING);
      });

      it("records the escrow of a payment confirmed earlier from the link, instead of treating it as a second payment", async () => {
        const id = await paid({ escrowId: undefined });

        await deliver("escrow.active", id, { id: "esc_1", amount: 200000 });

        expect(order().escrowId).toBe("esc_1");
        expect(order().refunds ?? []).toEqual([]);
      });

      it("treats a payment through a different link as a second payment when the order has no escrow yet", async () => {
        const id = await paid({ escrowId: undefined });

        await deliver("escrow.active", id, {
          id: "esc_2",
          reference: "PL-2",
          amount: 200000,
        });

        expect(order().escrowId).toBeUndefined();
        expect(order().refunds).toEqual([
          expect.objectContaining({
            reason: OrderRefundReason.DUPLICATE_PAYMENT,
            escrowId: "esc_2",
          }),
        ]);
      });

      it("keeps a cancelled paid order's escrow when a late payment lands on it", async () => {
        const id = await paid();
        await service.cancelOrder(userId, id);

        await deliver("escrow.active", id, {
          id: "esc_late",
          reference: "PL-2",
          amount: 200000,
        });

        expect(order().escrowId).toBe("esc_1");
        expect(order().refunds.map((r: Doc) => r.escrowId)).toEqual([
          "esc_1",
          "esc_late",
        ]);
      });
    });

    describe("disputes and alerts", () => {
      it("raises a dispute alert once and leaves fulfilment to the admin", async () => {
        const id = await paid();

        await deliver("escrow.disputed", id);
        await deliver("escrow.disputed", id);

        expect(order().status).toBe(OrderStatus.PENDING);
        expect(alertsOf()).toEqual([
          expect.objectContaining({
            type: OrderPaymentAlertType.ESCROW_DISPUTED,
            escrowId: "esc_1",
          }),
        ]);
      });

      it("lets an admin resolve an alert once, with a note", async () => {
        const id = await paid();
        await deliver("escrow.disputed", id);
        const alertId = String(alertsOf()[0]._id);

        const first = await service.resolvePaymentAlert(
          id,
          alertId,
          "admin-1",
          "  Settled with the shopper on Kashia  ",
        );
        const again = await service.resolvePaymentAlert(
          id,
          alertId,
          "admin-2",
          "Again",
        );

        expect(first).toMatchObject({ failed: false });
        expect(again).toMatchObject({ failed: true, code: 409 });
        expect(alertsOf()[0]).toMatchObject({
          resolvedAt: expect.any(Date),
          resolvedByAdminId: "admin-1",
          resolutionNote: "Settled with the shopper on Kashia",
        });
        await expect(
          service.resolvePaymentAlert(
            id,
            String(new Types.ObjectId()),
            "admin-1",
            "Unknown",
          ),
        ).resolves.toMatchObject({ failed: true, code: 404 });
      });

      it("only mirrors awaiting_confirmation", async () => {
        const id = await shipped();

        await deliver("escrow.awaiting_confirmation", id);

        expect(order()).toMatchObject({
          status: OrderStatus.SHIPPED,
          escrowStatus: "awaiting_confirmation",
        });
        expect(alertsOf()).toEqual([]);
      });
    });
  });

  describe("sweeping abandoned checkouts", () => {
    const MINUTE = 60 * 1000;
    const ticks = async (n: number) => {
      for (let i = 0; i < n; i++) await tick();
    };
    const setStock = (quantity: number) => {
      products.products.get(String(productId))!.defaultVariation.quantity =
        quantity;
    };
    const statusOf = (order: Doc) =>
      orders.orders.get(String(order._id))!.status;
    /** Unpaid order whose Kashia payment link reports `linkStatus`. */
    const withLink = (ageMs: number, reference: string, quantity = 1) =>
      seedUnpaidOrder(ageMs, quantity, { paymentReference: reference });
    const linkStatuses = (statuses: Record<string, string>) =>
      kashia.getPaymentLink.mockImplementation(async (reference: string) => ({
        reference,
        status: statuses[reference] ?? "active",
      }));

    it("puts stock held by abandoned checkouts back on sale without anyone running short", async () => {
      kashia.isConfigured.mockReturnValue(false); // no payment links to check
      const abandonedA = seedUnpaidOrder(45 * MINUTE, 2);
      const abandonedB = seedUnpaidOrder(31 * MINUTE, 2);
      const recent = seedUnpaidOrder(5 * MINUTE, 1);
      expect(products.stock(productId)).toBe(0); // looks sold out

      const result = await service.sweepAbandonedCheckouts();

      expect(result).toEqual({ examined: 2, released: 2, complete: true });
      expect(statusOf(abandonedA)).toBe(OrderStatus.CANCELLED);
      expect(statusOf(abandonedB)).toBe(OrderStatus.CANCELLED);
      expect(statusOf(recent)).toBe(OrderStatus.PENDING_PAYMENT);
      expect(products.stock(productId)).toBe(4);
    });

    it("keeps a hold whose payment link is still open, and asks Kashia about it at most once per recheck interval", async () => {
      setStock(10);
      const open = withLink(45 * MINUTE, "PL-OPEN");

      await service.sweepAbandonedCheckouts();
      await service.sweepAbandonedCheckouts();

      expect(statusOf(open)).toBe(OrderStatus.PENDING_PAYMENT);
      expect(kashia.getPaymentLink).toHaveBeenCalledTimes(1);

      orders.orders.get(String(open._id))!.stockHoldCheckedAt = new Date(
        Date.now() - STALE_HOLD_RECHECK_MS - 1000,
      );
      await service.sweepAbandonedCheckouts();

      expect(kashia.getPaymentLink).toHaveBeenCalledTimes(2);
    });

    it("releases a hold whose link Kashia has since expired", async () => {
      setStock(10);
      const expired = withLink(45 * MINUTE, "PL-EXP", 3);
      linkStatuses({ "PL-EXP": "expired" });

      const result = await service.sweepAbandonedCheckouts();

      expect(result.released).toBe(1);
      expect(statusOf(expired)).toBe(OrderStatus.CANCELLED);
      expect(products.stock(productId)).toBe(10);
    });

    it("confirms rather than cancels an abandoned-looking order that was actually paid", async () => {
      setStock(10);
      const paid = withLink(45 * MINUTE, "PL-PAID", 2);
      kashia.getPaymentLink.mockResolvedValue({
        status: "completed",
        reference: "PL-PAID",
        escrow_id: "esc_paid",
      });

      await service.sweepAbandonedCheckouts();

      expect(statusOf(paid)).toBe(OrderStatus.PENDING);
      expect(products.stock(productId)).toBe(8);
    });

    it("reaches every stale hold, however many open-link holds are older", async () => {
      setStock(100);
      const openLinks = Array.from(
        { length: STALE_HOLD_RECLAIM_LIMIT + 5 },
        (_, i) => withLink((120 + i) * MINUTE, `PL-OPEN-${i}`),
      );
      const expired = withLink(40 * MINUTE, "PL-EXP"); // the newest
      linkStatuses({ "PL-EXP": "expired" });

      const result = await service.sweepAbandonedCheckouts();

      expect(result).toMatchObject({
        examined: openLinks.length + 1,
        released: 1,
        complete: true,
      });
      expect(statusOf(expired)).toBe(OrderStatus.CANCELLED);
      expect(
        openLinks.every((o) => statusOf(o) === OrderStatus.PENDING_PAYMENT),
      ).toBe(true);
    });

    it("releases a hold past the maximum even if it was checked moments ago", async () => {
      setStock(10);
      const old = withLink(PENDING_PAYMENT_MAX_HOLD_MS + MINUTE, "PL-OLD", 2);
      orders.orders.get(String(old._id))!.stockHoldCheckedAt = new Date();

      await service.sweepAbandonedCheckouts();

      expect(statusOf(old)).toBe(OrderStatus.CANCELLED);
      expect(products.stock(productId)).toBe(10);
    });

    it("finishes when Kashia cannot be reached, leaving holds for the next run", async () => {
      setStock(10);
      const a = withLink(45 * MINUTE, "PL-A");
      const b = withLink(50 * MINUTE, "PL-B");
      kashia.getPaymentLink.mockRejectedValue(new Error("Kashia down"));

      const result = await service.sweepAbandonedCheckouts();

      expect(result).toEqual({ examined: 2, released: 0, complete: true });
      expect([statusOf(a), statusOf(b)]).toEqual([
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.PENDING_PAYMENT,
      ]);
      expect(kashia.getPaymentLink).toHaveBeenCalledTimes(2); // no retry loop
    });

    it("stops at its time budget and the next run carries on", async () => {
      kashia.isConfigured.mockReturnValue(false);
      const abandoned = seedUnpaidOrder(45 * MINUTE, 2);

      const cut = await service.sweepAbandonedCheckouts({ timeBudgetMs: 0 });
      expect(cut).toEqual({ examined: 0, released: 0, complete: false });
      expect(statusOf(abandoned)).toBe(OrderStatus.PENDING_PAYMENT);

      await service.sweepAbandonedCheckouts();
      expect(statusOf(abandoned)).toBe(OrderStatus.CANCELLED);
    });

    it.each([-6, -4, -2, -1, 0, 1, 2, 4, 6])(
      "returns a hold's stock once when a sweep races a checkout reclaiming it (offset %i)",
      async (offset) => {
        kashia.isConfigured.mockReturnValue(false);
        const abandoned = seedUnpaidOrder(45 * MINUTE, 4); // 1 left
        cartItems = [line(2)];

        const [, placed] = await Promise.all([
          ticks(Math.max(offset, 0)).then(() =>
            service.sweepAbandonedCheckouts(),
          ),
          ticks(Math.max(-offset, 0)).then(() => checkout()),
        ]);

        expect(statusOf(abandoned)).toBe(OrderStatus.CANCELLED);
        expect(placed).toMatchObject({ failed: false, code: 201 });
        expect(products.stock(productId)).toBe(3); // 5 - 4 + 4 - 2
        expect(
          orders.orders
            .get(String(abandoned._id))!
            .timeline.filter((t: Doc) => t.status === OrderStatus.CANCELLED),
        ).toHaveLength(1);
      },
    );

    it.each([0, 1, 2, 4, 6, 8])(
      "keeps stock consistent even when the returned stock lands after the checkout gave up (offset %i)",
      async (offset) => {
        kashia.isConfigured.mockReturnValue(false);
        const abandoned = seedUnpaidOrder(45 * MINUTE, 4); // 1 left
        cartItems = [line(2)];
        // Returning stock is slow (e.g. database latency).
        const update = products.updateOne.bind(products);
        jest
          .spyOn(products, "updateOne")
          .mockImplementation(async (filter: Doc, change: Doc) => {
            const [delta] = Object.values(change.$inc) as number[];
            if (delta > 0) await ticks(12);
            return update(filter, change);
          });

        const [, placed] = await Promise.all([
          service.sweepAbandonedCheckouts(),
          ticks(offset).then(() => checkout()),
        ]);

        // The shopper may be told it is short while the stock is on its
        // way back (a retry then succeeds), but stock is never lost or
        // counted twice.
        expect(statusOf(abandoned)).toBe(OrderStatus.CANCELLED);
        expect(products.stock(productId)).toBe(placed.failed ? 5 : 3);
      },
    );
  });

  describe("crash safety", () => {
    /**
     * The process dies: from now on it cannot write anything, so only the
     * database undoing an unfinished transaction can put things right.
     */
    const crash = () => {
      const dead = async () => {
        throw new Error("process died");
      };
      jest.spyOn(products, "updateOne").mockImplementation(dead as never);
      jest.spyOn(orders, "insertOrder").mockImplementation(dead as never);
      jest.spyOn(orders, "transitionStatus").mockImplementation(dead as never);
    };
    const restart = () => jest.restoreAllMocks();

    it("leaves neither stock held nor an order when checkout dies before the order is saved", async () => {
      jest.spyOn(orders, "insertOrder").mockImplementationOnce(async () => {
        crash();
        throw new Error("process died");
      });

      await checkout().catch(() => undefined);

      expect(orders.orders.size).toBe(0);
      expect(products.stock(productId)).toBe(5);
    });

    it("keeps stock and status together when a cancellation dies before returning the stock", async () => {
      const id = String((await checkout()).data._id);
      const transition = orders.transitionStatus.bind(orders);
      jest
        .spyOn(orders, "transitionStatus")
        .mockImplementationOnce(async (...args: any[]) => {
          const result = await (transition as any)(...args);
          crash(); // dies right after the order was marked cancelled
          return result;
        });

      await expect(service.cancelOrder(userId, id)).rejects.toThrow(
        "process died",
      );

      // Rolled back together: still awaiting payment, still holding stock.
      expect(orders.only()).toMatchObject({
        status: OrderStatus.PENDING_PAYMENT,
        stockReserved: true,
      });
      expect(products.stock(productId)).toBe(3);

      restart();
      await service.cancelOrder(userId, id); // the shopper tries again
      expect(orders.only().status).toBe(OrderStatus.CANCELLED);
      expect(products.stock(productId)).toBe(5);
    });

    it("saves nothing for a checkout that outlived its lock; the checkout that took over saves one order", async () => {
      let takeover: Promise<Doc> | undefined;
      const reserve = products.updateOne.bind(products);
      jest
        .spyOn(products, "updateOne")
        .mockImplementationOnce(async (...args: [Doc, Doc, Doc?]) => {
          // The first checkout is slow; its lock expires and a second
          // submit takes the lock and completes meanwhile.
          lock.expire(userId);
          takeover = checkout();
          await takeover;
          return reserve(...args);
        });

      const slow = await checkout();
      const fast = await takeover!;

      expect(fast).toMatchObject({ failed: false, code: 201 });
      expect(slow).toMatchObject({ failed: true, code: 409 });
      expect(slow.description).toMatch(/checkout is already in progress/);
      expect(orders.orders.size).toBe(1);
      expect(products.stock(productId)).toBe(3); // reserved once
    });

    describe("on a server without transactions (e.g. local development)", () => {
      beforeEach(() => {
        transactions.supported = false;
      });

      it("still returns the stock when the order cannot be saved", async () => {
        orders.failNextCreate = true;

        const result = await checkout();

        expect(result).toMatchObject({ failed: true, code: 500 });
        expect(orders.orders.size).toBe(0);
        expect(products.stock(productId)).toBe(5);
      });

      it("still returns the stock of a cancelled order", async () => {
        const id = String((await checkout()).data._id);

        await service.cancelOrder(userId, id);

        expect(orders.only().status).toBe(OrderStatus.CANCELLED);
        expect(products.stock(productId)).toBe(5);
      });

      it("still refuses to save an order for a checkout that lost its lock", async () => {
        jest
          .spyOn(cartsService, "confirmCheckoutLock")
          .mockResolvedValueOnce(false as never);

        const result = await checkout();

        expect(result).toMatchObject({ failed: true, code: 409 });
        expect(orders.orders.size).toBe(0);
        expect(products.stock(productId)).toBe(5);
      });
    });
  });
});
