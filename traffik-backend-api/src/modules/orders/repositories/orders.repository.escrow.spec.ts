import mongoose, { Model, Query, Types } from "mongoose";
import { OrdersRepository } from "./orders.repository";
import { OrderDocument, OrderSchema } from "../schemas/order.schema";
import { OrderStatus } from "../enums/order.enum";
import {
  OrderPaymentAlertType,
  TERMINAL_ESCROW_STATUSES,
} from "../enums/order-escrow.enum";

/**
 * The escrow updates against the real Order schema, cast by Mongoose but not
 * sent to a database (see orders.repository.refunds.spec.ts): a path the
 * schema does not know would be dropped without an error.
 */
describe("OrdersRepository escrow updates (cast against the Order schema)", () => {
  const OrderModel = mongoose.model(
    "OrderEscrowCastSpec",
    OrderSchema,
  ) as unknown as Model<OrderDocument>;
  const repository = new OrdersRepository(OrderModel);
  const orderId = new Types.ObjectId();

  let captured: Array<{ filter: any; update: any }>;
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
      });
      return Promise.resolve(
        results.length
          ? results.shift()
          : { matchedCount: 1, modifiedCount: 1 },
      );
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it("adopts an escrow only for an order without one, paid through that link", async () => {
    await repository.adoptEscrow(orderId, "esc_1", "PL-1");

    expect(captured[0]).toEqual({
      filter: { _id: orderId, escrowId: null, paymentReference: "PL-1" },
      update: { $set: { escrowId: "esc_1" } },
    });
  });

  describe("mirrorEscrowStatus", () => {
    const at = new Date("2026-03-01T10:00:00Z");

    it("mirrors only the order's own escrow, and never older or non-final-after-final", async () => {
      await repository.mirrorEscrowStatus(
        orderId,
        "esc_1",
        "awaiting_confirmation",
        at,
      );

      expect(captured[0].filter).toEqual({
        _id: orderId,
        escrowId: "esc_1",
        $and: [
          { escrowStatus: { $nin: [...TERMINAL_ESCROW_STATUSES] } },
          {
            $or: [{ escrowStatusAt: null }, { escrowStatusAt: { $lte: at } }],
          },
        ],
      });
      expect(captured[0].update).toEqual({
        $set: { escrowStatus: "awaiting_confirmation", escrowStatusAt: at },
      });
    });

    it("lets a final status replace anything not newer, and needs no time", async () => {
      await repository.mirrorEscrowStatus(orderId, "esc_1", "completed");

      expect(captured[0]).toEqual({
        filter: { _id: orderId, escrowId: "esc_1" },
        update: { $set: { escrowStatus: "completed" } },
      });
    });

    it("counts a redelivery (same values, nothing modified) as current", async () => {
      results = [{ matchedCount: 1, modifiedCount: 0 }];

      await expect(
        repository.mirrorEscrowStatus(orderId, "esc_1", "completed"),
      ).resolves.toBe(true);
    });

    it("reports a stale event or another escrow as not current", async () => {
      results = [{ matchedCount: 0, modifiedCount: 0 }];

      await expect(
        repository.mirrorEscrowStatus(orderId, "esc_1", "completed"),
      ).resolves.toBe(false);
    });
  });

  it("raises an alert at most once per type and escrow", async () => {
    await repository.addPaymentAlert(orderId, {
      type: OrderPaymentAlertType.ESCROW_DISPUTED,
      escrowId: "esc_1",
      orderStatus: OrderStatus.PENDING,
      message: "Disputed",
    });

    const { filter, update } = captured[0];
    expect(filter).toEqual({
      _id: orderId,
      paymentAlerts: {
        $not: {
          $elemMatch: {
            type: OrderPaymentAlertType.ESCROW_DISPUTED,
            escrowId: "esc_1",
          },
        },
      },
    });
    expect(update.$push.paymentAlerts).toMatchObject({
      _id: expect.any(Types.ObjectId),
      type: OrderPaymentAlertType.ESCROW_DISPUTED,
      escrowId: "esc_1",
      orderStatus: OrderStatus.PENDING,
      message: "Disputed",
      raisedAt: expect.any(Date),
    });
  });

  it("de-duplicates an alert with no escrow against others with no escrow", async () => {
    await repository.addPaymentAlert(orderId, {
      type: OrderPaymentAlertType.ESCROW_DISPUTED,
      orderStatus: OrderStatus.PENDING,
      message: "Disputed",
    });

    expect(captured[0].filter.paymentAlerts.$not.$elemMatch).toEqual({
      type: OrderPaymentAlertType.ESCROW_DISPUTED,
      escrowId: null,
    });
  });

  it("resolves only an open alert, keeping who and how", async () => {
    const alertId = new Types.ObjectId();

    await repository.resolvePaymentAlert(orderId, alertId, {
      adminId: "admin-1",
      note: "Recovered from the store",
    });

    const { filter, update } = captured[0];
    expect(filter).toEqual({
      _id: orderId,
      paymentAlerts: { $elemMatch: { _id: alertId, resolvedAt: null } },
    });
    expect(update.$set).toEqual({
      "paymentAlerts.$.resolvedAt": expect.any(Date),
      "paymentAlerts.$.resolvedByAdminId": "admin-1",
      "paymentAlerts.$.resolutionNote": "Recovered from the store",
    });
  });

  it("keeps the mirrored status time on the order", () => {
    expect(OrderSchema.path("escrowStatusAt")).toBeDefined();
    expect(OrderSchema.path("paymentAlerts")).toBeDefined();
  });
});
