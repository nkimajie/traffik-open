import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  ClientSession,
  FilterQuery,
  Model,
  Types,
  UpdateQuery,
} from "mongoose";
import { BaseRepository } from "src/modules/shared/base/repository.base";
import { Order, OrderDocument } from "../schemas/order.schema";
import { OrderStatus } from "../enums/order.enum";
import {
  OrderRefundActor,
  OrderRefundEventType,
  OrderRefundPayoutMethod,
  OrderRefundResolution,
  OrderRefundStatus,
} from "../enums/order-refund.enum";
import {
  IOrderRefundPayout,
  NewOrderRefund,
} from "../interfaces/order-refund.interface";
import { newRefundRecord } from "../utils/order-refund.util";
import { TERMINAL_ESCROW_STATUSES } from "../enums/order-escrow.enum";
import { IOrderPaymentAlert } from "../interfaces/order-escrow.interface";

@Injectable()
export class OrdersRepository extends BaseRepository<OrderDocument> {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {
    super(orderModel);
  }

  /**
   * Applies `update` only if the order is currently in `fromStatus` (and
   * matches `extraFilter`), in one atomic operation, so two concurrent callers
   * cannot both move the same order. Returns null when the order no longer
   * matches.
   *
   * Goes through the model directly: BaseRepository.update re-reads by the
   * same filter after writing, which would miss a document whose status just
   * changed.
   *
   * @param returnUpdated false returns the document as it was before the update.
   * @param session to make the change part of a transaction.
   */
  async transitionStatus(
    orderId: Types.ObjectId,
    fromStatus: OrderStatus,
    update: UpdateQuery<OrderDocument>,
    returnUpdated = true,
    extraFilter: FilterQuery<OrderDocument> = {},
    session?: ClientSession,
  ): Promise<OrderDocument | null> {
    return this.orderModel.findOneAndUpdate(
      { ...extraFilter, _id: orderId, status: fromStatus },
      update,
      { new: returnUpdated, session },
    );
  }

  /**
   * Saves a new order, optionally as part of a transaction. Unlike
   * BaseRepository.create, a failure is thrown rather than reported as null,
   * so a transaction it is part of is rolled back.
   */
  async insertOrder(
    order: Partial<OrderDocument>,
    session?: ClientSession,
  ): Promise<OrderDocument> {
    const [created] = await this.orderModel.create([order], { session });
    return created.toObject() as OrderDocument;
  }

  /** A shopper's unpaid orders with one store, newest first. */
  async findPendingPaymentOrdersForStore(
    userId: Types.ObjectId,
    vendorId: Types.ObjectId,
  ): Promise<OrderDocument[]> {
    return this.orderModel
      .find({ userId, vendorId, status: OrderStatus.PENDING_PAYMENT })
      .sort({ createdAt: -1 });
  }

  /**
   * Unpaid orders holding stock past their hold window, for a sweep or a
   * checkout that ran short. When `productIds` is given, only orders holding
   * one of those products (order lines store the id as an ObjectId or a
   * string, so both are matched).
   *
   * Orders checked with Kashia since `checkedBefore` (their link was still
   * open) are left out unless they are past the maximum hold, and unchecked
   * orders come first, then the least recently checked: holds that stay open
   * cannot crowd out the rest.
   */
  async findStalePendingPaymentOrders(query: {
    createdBefore: Date;
    checkedBefore: Date;
    maxHoldBefore: Date;
    limit: number;
    productIds?: Types.ObjectId[];
  }): Promise<OrderDocument[]> {
    const productIds = query.productIds ?? [];
    const productFilter = productIds.length
      ? {
          "items.productId": {
            $in: [...productIds, ...productIds.map((id) => String(id))],
          },
        }
      : {};

    return this.orderModel
      .find({
        status: OrderStatus.PENDING_PAYMENT,
        createdAt: { $lt: query.createdBefore },
        $or: [
          { stockHoldCheckedAt: null },
          { stockHoldCheckedAt: { $lt: query.checkedBefore } },
          { createdAt: { $lt: query.maxHoldBefore } },
        ],
        ...productFilter,
      })
      .sort({ stockHoldCheckedAt: 1, createdAt: 1 })
      .limit(query.limit);
  }

  /** Notes that an unpaid order's hold was just checked (and kept). */
  async markStockHoldChecked(
    orderId: Types.ObjectId,
    checkedAt: Date,
  ): Promise<void> {
    await this.orderModel.updateOne(
      { _id: orderId, status: OrderStatus.PENDING_PAYMENT },
      { $set: { stockHoldCheckedAt: checkedAt } },
    );
  }

  /**
   * Opens a refund obligation for the money in one escrow, at most once per
   * escrow, so a redelivered payment webhook cannot ask for it back twice.
   *
   * A refund opened before the escrow id was known (the order was confirmed
   * from the payment link, which may not carry it) is the same payment as a
   * later report with the id and the same payment reference: the id is added
   * to it rather than opening a second refund.
   *
   * @returns true if a new refund was opened.
   */
  async addRefund(
    orderId: Types.ObjectId,
    refund: NewOrderRefund & { escrowId: string },
  ): Promise<boolean> {
    const notYetRecorded = {
      _id: orderId,
      "refunds.escrowId": { $ne: refund.escrowId },
    };

    if (refund.paymentReference) {
      const attached = await this.orderModel.updateOne(
        {
          ...notYetRecorded,
          refunds: {
            $elemMatch: {
              escrowId: null,
              paymentReference: refund.paymentReference,
            },
          },
        },
        { $set: { "refunds.$[open].escrowId": refund.escrowId } },
        {
          arrayFilters: [
            {
              "open.escrowId": null,
              "open.paymentReference": refund.paymentReference,
            },
          ],
        },
      );
      if (attached.modifiedCount > 0) {
        return false;
      }
    }

    const pushed = await this.orderModel.updateOne(notYetRecorded, {
      $push: { refunds: newRefundRecord(refund) },
    });
    return pushed.modifiedCount > 0;
  }

  /** Remembers that Kashia refunded `escrowId` (whether or not a refund is open yet). */
  async markEscrowRefundedByProvider(
    orderId: Types.ObjectId,
    escrowId: string,
  ): Promise<void> {
    await this.orderModel.updateOne(
      { _id: orderId },
      { $addToSet: { providerRefundedEscrowIds: escrowId } },
    );
  }

  /**
   * Closes an outstanding refund because Kashia returned the money. Matched
   * by `refundMatch` (escrow id, or payment reference for a refund opened
   * before the id was known, in which case `attachEscrowId` records it).
   *
   * With `onlyIfProviderRefunded`, applies only if Kashia has already
   * reported that escrow refunded: used right after opening a refund, in case
   * the report arrived first.
   *
   * @returns the updated order, or null when nothing matched.
   */
  async completeRefundFromProvider(
    orderId: Types.ObjectId,
    refundMatch: Record<string, unknown>,
    options: { attachEscrowId?: string; onlyIfProviderRefunded?: string } = {},
  ): Promise<OrderDocument | null> {
    const now = new Date();
    return this.orderModel.findOneAndUpdate(
      {
        _id: orderId,
        ...(options.onlyIfProviderRefunded && {
          providerRefundedEscrowIds: options.onlyIfProviderRefunded,
        }),
        refunds: {
          $elemMatch: { ...refundMatch, status: OrderRefundStatus.REQUIRED },
        },
      },
      {
        $set: {
          "refunds.$.status": OrderRefundStatus.REFUNDED,
          "refunds.$.refundedAt": now,
          "refunds.$.resolvedBy": OrderRefundResolution.KASHIA,
          "refunds.$.providerConfirmedAt": now,
          ...(options.attachEscrowId && {
            "refunds.$.escrowId": options.attachEscrowId,
          }),
        },
        $push: {
          "refunds.$.history": {
            type: OrderRefundEventType.COMPLETED,
            actor: OrderRefundActor.KASHIA,
            at: now,
          },
        },
      },
      { new: true },
    );
  }

  /**
   * Records that Kashia refunded money an admin had already completed by
   * hand, once per refund. `payoutMethod` must still be the completion's
   * method, so the flag is computed from what is actually stored.
   */
  async recordProviderRefundOfManualRefund(
    orderId: Types.ObjectId,
    refundMatch: Record<string, unknown>,
    payoutMethod: OrderRefundPayoutMethod,
    possibleDoubleRefund: boolean,
  ): Promise<OrderDocument | null> {
    const now = new Date();
    return this.orderModel.findOneAndUpdate(
      {
        _id: orderId,
        refunds: {
          $elemMatch: {
            ...refundMatch,
            status: OrderRefundStatus.REFUNDED,
            resolvedBy: OrderRefundResolution.ADMIN,
            "payout.method": payoutMethod,
            providerConfirmedAt: null,
          },
        },
      },
      {
        $set: { "refunds.$.providerConfirmedAt": now },
        $push: {
          "refunds.$.history": {
            type: OrderRefundEventType.PROVIDER_REFUNDED,
            actor: OrderRefundActor.KASHIA,
            at: now,
            possibleDoubleRefund,
          },
        },
      },
      { new: true },
    );
  }

  /**
   * An admin records a refund they made by hand. Applies only while the
   * refund is still owed, so two admins (or an admin and Kashia) cannot both
   * complete it.
   */
  async completeRefundManually(
    orderId: Types.ObjectId,
    refundId: Types.ObjectId,
    completion: {
      completionId: Types.ObjectId;
      adminId: string;
      payout: IOrderRefundPayout;
      note?: string;
    },
  ): Promise<OrderDocument | null> {
    const now = new Date();
    // The history keeps the evidence as given, not the internal lookup key.
    const { method, reference, amount } = completion.payout;
    const evidence = { method, reference, amount };
    return this.orderModel.findOneAndUpdate(
      {
        _id: orderId,
        refunds: {
          $elemMatch: { _id: refundId, status: OrderRefundStatus.REQUIRED },
        },
      },
      {
        $set: {
          "refunds.$.status": OrderRefundStatus.REFUNDED,
          "refunds.$.refundedAt": now,
          "refunds.$.resolvedBy": OrderRefundResolution.ADMIN,
          "refunds.$.resolvedByAdminId": completion.adminId,
          "refunds.$.payout": completion.payout,
          "refunds.$.completionId": completion.completionId,
          ...(completion.note && { "refunds.$.note": completion.note }),
        },
        $push: {
          "refunds.$.history": {
            _id: completion.completionId,
            type: OrderRefundEventType.COMPLETED,
            actor: OrderRefundActor.ADMIN,
            actorId: completion.adminId,
            at: now,
            payout: evidence,
          },
        },
      },
      { new: true },
    );
  }

  /**
   * Puts a refund an admin completed by hand back in the queue: the admin
   * corrected a mistake, or the shopper reported the money never arrived.
   * Refunds Kashia confirmed cannot be reopened. The completion stays in the
   * history; `orderFilter` can scope the order (e.g. to its shopper) and
   * `refundedSince` limits how long after completion this is allowed.
   */
  async reopenRefund(
    orderId: Types.ObjectId,
    refundId: Types.ObjectId,
    reopen: {
      actor: OrderRefundActor;
      actorId: string;
      reason: string;
      orderFilter?: Record<string, unknown>;
      refundedSince?: Date;
      /** Only undo this completion (the one the caller read). */
      completionId?: Types.ObjectId;
    },
  ): Promise<OrderDocument | null> {
    return this.orderModel.findOneAndUpdate(
      {
        ...reopen.orderFilter,
        _id: orderId,
        refunds: {
          $elemMatch: {
            _id: refundId,
            status: OrderRefundStatus.REFUNDED,
            resolvedBy: OrderRefundResolution.ADMIN,
            providerConfirmedAt: null,
            ...(reopen.completionId && { completionId: reopen.completionId }),
            ...(reopen.refundedSince && {
              refundedAt: { $gte: reopen.refundedSince },
            }),
          },
        },
      },
      {
        $set: { "refunds.$.status": OrderRefundStatus.REQUIRED },
        $unset: {
          "refunds.$.refundedAt": "",
          "refunds.$.resolvedBy": "",
          "refunds.$.resolvedByAdminId": "",
          "refunds.$.payout": "",
          "refunds.$.completionId": "",
          "refunds.$.note": "",
        },
        $push: {
          "refunds.$.history": {
            type: OrderRefundEventType.REOPENED,
            actor: reopen.actor,
            actorId: reopen.actorId,
            at: new Date(),
            reason: reopen.reason,
          },
        },
      },
      { new: true },
    );
  }

  /**
   * Records `escrowId` as the order's escrow when the order has none yet and
   * the escrow was paid through the order's own payment link (the order was
   * confirmed from the link, which may not carry the escrow id).
   */
  async adoptEscrow(
    orderId: Types.ObjectId,
    escrowId: string,
    paymentReference: string,
  ): Promise<boolean> {
    const result = await this.orderModel.updateOne(
      { _id: orderId, escrowId: null, paymentReference },
      { $set: { escrowId } },
    );
    return result.modifiedCount > 0;
  }

  /**
   * Mirrors the status of the order's own escrow, and only that escrow, so
   * events about another escrow (e.g. a duplicate payment) never overwrite
   * it. An event older than the one already applied, or a non-final status
   * after a final one, arrived out of order and is ignored.
   *
   * @returns whether the event is current (applied now, or already applied
   *   by an earlier delivery of it), as opposed to stale or for another escrow.
   */
  async mirrorEscrowStatus(
    orderId: Types.ObjectId,
    escrowId: string,
    escrowStatus: string,
    occurredAt?: Date,
  ): Promise<boolean> {
    const conditions: FilterQuery<OrderDocument>[] = [];
    if (!TERMINAL_ESCROW_STATUSES.includes(escrowStatus)) {
      conditions.push({ escrowStatus: { $nin: TERMINAL_ESCROW_STATUSES } });
    }
    if (occurredAt) {
      conditions.push({
        $or: [
          { escrowStatusAt: null },
          { escrowStatusAt: { $lte: occurredAt } },
        ],
      });
    }

    const result = await this.orderModel.updateOne(
      {
        _id: orderId,
        escrowId,
        ...(conditions.length > 0 && { $and: conditions }),
      },
      {
        $set: {
          escrowStatus,
          ...(occurredAt && { escrowStatusAt: occurredAt }),
        },
      },
    );
    // Matched, not modified: a redelivery sets the same values (nothing
    // modified) but is still current, and its effects must still run in case
    // an earlier attempt failed after this point.
    return result.matchedCount > 0;
  }

  /**
   * Raises a payment alert, at most once per type and escrow, so a
   * redelivered webhook does not raise it again.
   *
   * @returns whether a new alert was raised.
   */
  async addPaymentAlert(
    orderId: Types.ObjectId,
    alert: Omit<IOrderPaymentAlert, "_id" | "raisedAt">,
  ): Promise<boolean> {
    const result = await this.orderModel.updateOne(
      {
        _id: orderId,
        paymentAlerts: {
          $not: {
            $elemMatch: { type: alert.type, escrowId: alert.escrowId ?? null },
          },
        },
      },
      { $push: { paymentAlerts: { ...alert, raisedAt: new Date() } } },
    );
    return result.modifiedCount > 0;
  }

  /** Marks an open payment alert resolved; a resolved one is left as it is. */
  async resolvePaymentAlert(
    orderId: Types.ObjectId,
    alertId: Types.ObjectId,
    resolution: { adminId: string; note: string },
  ): Promise<OrderDocument | null> {
    return this.orderModel.findOneAndUpdate(
      {
        _id: orderId,
        paymentAlerts: { $elemMatch: { _id: alertId, resolvedAt: null } },
      },
      {
        $set: {
          "paymentAlerts.$.resolvedAt": new Date(),
          "paymentAlerts.$.resolvedByAdminId": resolution.adminId,
          "paymentAlerts.$.resolutionNote": resolution.note,
        },
      },
      { new: true },
    );
  }
}
