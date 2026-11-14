import mongoose, { Model, Query, Types } from "mongoose";
import { OrdersRepository } from "./orders.repository";
import { OrderDocument, OrderSchema } from "../schemas/order.schema";
import {
  OrderRefundActor,
  OrderRefundEventType,
  OrderRefundPayoutMethod,
  OrderRefundReason,
  OrderRefundResolution,
  OrderRefundStatus,
} from "../enums/order-refund.enum";

/**
 * The refund updates against the real Order schema, cast by Mongoose but not
 * sent to a database. Guards against the silent failure mode of strict
 * schemas: a path the schema does not know is dropped from an update without
 * an error.
 */
describe("OrdersRepository refund updates (cast against the Order schema)", () => {
  const OrderModel = mongoose.model(
    "OrderRefundCastSpec",
    OrderSchema,
  ) as unknown as Model<OrderDocument>;
  const repository = new OrdersRepository(OrderModel);
  const orderId = new Types.ObjectId();
  const refundId = new Types.ObjectId();

  let captured: Array<{ filter: any; update: any; options: any }>;
  /** What each successive update reports; defaults to "applied". */
  let results: unknown[];

  beforeEach(() => {
    captured = [];
    results = [];
    jest.spyOn(Query.prototype, "exec").mockImplementation(function (
      this: any,
    ) {
      this._castConditions();
      expect(this.error()).toBeFalsy();
      captured.push({
        filter: this.getFilter(),
        update: this._castUpdate(this._update),
        options: this.getOptions(),
      });
      return Promise.resolve(
        results.length ? results.shift() : { modifiedCount: 1 },
      );
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it("opens a refund with its own id, an opening history entry, and never twice for one escrow", async () => {
    results = [{ modifiedCount: 0 }]; // nothing to attach the escrow to

    await repository.addRefund(orderId, {
      reason: OrderRefundReason.PAID_AFTER_CANCELLATION,
      amount: 2000,
      escrowId: "esc_1",
      paymentReference: "PL-1",
    });

    // First the attach attempt, then the guarded push.
    expect(captured).toHaveLength(2);
    const [attach, push] = captured;
    expect(attach.options.arrayFilters).toEqual([
      { "open.escrowId": null, "open.paymentReference": "PL-1" },
    ]);
    expect(push.filter).toMatchObject({
      _id: orderId,
      "refunds.escrowId": { $ne: "esc_1" },
    });
    const refund = push.update.$push.refunds;
    expect(refund).toMatchObject({
      status: OrderRefundStatus.REQUIRED,
      reason: OrderRefundReason.PAID_AFTER_CANCELLATION,
      amount: 2000,
      escrowId: "esc_1",
      paymentReference: "PL-1",
      requestedAt: expect.any(Date),
    });
    expect(refund._id).toBeInstanceOf(Types.ObjectId);
    expect(refund.history).toEqual([
      expect.objectContaining({
        _id: expect.any(Types.ObjectId),
        type: OrderRefundEventType.OPENED,
        actor: OrderRefundActor.SYSTEM,
      }),
    ]);
  });

  it("keeps every field of a manual completion and its history entry", async () => {
    const completionId = new Types.ObjectId();

    await repository.completeRefundManually(orderId, refundId, {
      completionId,
      adminId: "admin-1",
      payout: {
        method: OrderRefundPayoutMethod.BANK_TRANSFER,
        reference: "FT-0001",
        referenceKey: "FT-0001",
        amount: 2000,
      },
      note: "To your GTBank account",
    });

    const { filter, update } = captured[0];
    expect(filter.refunds.$elemMatch).toEqual({
      _id: refundId,
      status: OrderRefundStatus.REQUIRED,
    });
    const { "refunds.$.payout": payout, ...rest } = update.$set;
    expect(rest).toEqual({
      "refunds.$.status": OrderRefundStatus.REFUNDED,
      "refunds.$.refundedAt": expect.any(Date),
      "refunds.$.resolvedBy": OrderRefundResolution.ADMIN,
      "refunds.$.resolvedByAdminId": "admin-1",
      "refunds.$.completionId": completionId,
      "refunds.$.note": "To your GTBank account",
    });
    expect(payout.toObject()).toEqual({
      method: OrderRefundPayoutMethod.BANK_TRANSFER,
      reference: "FT-0001",
      referenceKey: "FT-0001",
      amount: 2000,
    });
    const event = update.$push["refunds.$.history"];
    expect(event).toMatchObject({
      _id: completionId,
      type: OrderRefundEventType.COMPLETED,
      actor: OrderRefundActor.ADMIN,
      actorId: "admin-1",
    });
    // The history keeps the evidence, not the internal lookup key.
    expect(event.payout.toObject()).toEqual({
      method: OrderRefundPayoutMethod.BANK_TRANSFER,
      reference: "FT-0001",
      amount: 2000,
    });
  });

  it("closes a refund for Kashia only once Kashia has reported that escrow, when asked to", async () => {
    await repository.completeRefundFromProvider(
      orderId,
      { escrowId: "esc_1" },
      { onlyIfProviderRefunded: "esc_1" },
    );

    const { filter, update } = captured[0];
    expect(filter).toMatchObject({
      _id: orderId,
      providerRefundedEscrowIds: "esc_1",
      refunds: {
        $elemMatch: { escrowId: "esc_1", status: OrderRefundStatus.REQUIRED },
      },
    });
    expect(update.$set).toMatchObject({
      "refunds.$.status": OrderRefundStatus.REFUNDED,
      "refunds.$.resolvedBy": OrderRefundResolution.KASHIA,
      "refunds.$.providerConfirmedAt": expect.any(Date),
    });
    expect(update.$push["refunds.$.history"]).toMatchObject({
      type: OrderRefundEventType.COMPLETED,
      actor: OrderRefundActor.KASHIA,
    });
  });

  it("remembers a refunded escrow as a set", async () => {
    await repository.markEscrowRefundedByProvider(orderId, "esc_1");

    expect(captured[0].update).toEqual({
      $addToSet: { providerRefundedEscrowIds: "esc_1" },
    });
  });

  it("flags Kashia refunding a manual refund against what is stored", async () => {
    await repository.recordProviderRefundOfManualRefund(
      orderId,
      { _id: refundId },
      OrderRefundPayoutMethod.BANK_TRANSFER,
      true,
    );

    const { filter, update } = captured[0];
    expect(filter.refunds.$elemMatch).toMatchObject({
      _id: refundId,
      status: OrderRefundStatus.REFUNDED,
      resolvedBy: OrderRefundResolution.ADMIN,
      "payout.method": OrderRefundPayoutMethod.BANK_TRANSFER,
      providerConfirmedAt: null,
    });
    expect(update.$set).toEqual({
      "refunds.$.providerConfirmedAt": expect.any(Date),
    });
    expect(update.$push["refunds.$.history"]).toMatchObject({
      type: OrderRefundEventType.PROVIDER_REFUNDED,
      actor: OrderRefundActor.KASHIA,
      possibleDoubleRefund: true,
    });
  });

  it("reopens only the manual, unconfirmed completion it read, scoped and time-limited when asked, clearing its evidence", async () => {
    const userId = new Types.ObjectId();
    const since = new Date("2026-01-01T00:00:00Z");
    const completionId = new Types.ObjectId();

    await repository.reopenRefund(orderId, refundId, {
      actor: OrderRefundActor.SHOPPER,
      actorId: String(userId),
      reason: "Shopper reported the refund was not received",
      orderFilter: { userId },
      refundedSince: since,
      completionId,
    });

    const { filter, update } = captured[0];
    expect(filter).toMatchObject({ _id: orderId, userId });
    expect(filter.refunds.$elemMatch).toMatchObject({
      _id: refundId,
      status: OrderRefundStatus.REFUNDED,
      resolvedBy: OrderRefundResolution.ADMIN,
      providerConfirmedAt: null,
      // Only the completion the caller read is undone.
      completionId,
      refundedAt: { $gte: since },
    });
    expect(update.$set).toEqual({
      "refunds.$.status": OrderRefundStatus.REQUIRED,
    });
    expect(Object.keys(update.$unset).sort()).toEqual(
      [
        "refunds.$.completionId",
        "refunds.$.note",
        "refunds.$.payout",
        "refunds.$.refundedAt",
        "refunds.$.resolvedBy",
        "refunds.$.resolvedByAdminId",
      ].sort(),
    );
    expect(update.$push["refunds.$.history"]).toMatchObject({
      type: OrderRefundEventType.REOPENED,
      actor: OrderRefundActor.SHOPPER,
      reason: "Shopper reported the refund was not received",
    });
  });
});
