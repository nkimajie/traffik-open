import mongoose, { Model, Query, Types } from "mongoose";
import { OrdersRepository } from "./orders.repository";
import { OrderDocument, OrderSchema } from "../schemas/order.schema";
import { OrderStatus } from "../enums/order.enum";

/**
 * The stale-hold queries against the real Order schema, cast by Mongoose but
 * not sent to a database (see orders.repository.refunds.spec.ts).
 */
describe("OrdersRepository stale stock holds (cast against the Order schema)", () => {
  const OrderModel = mongoose.model(
    "OrderStockHoldsCastSpec",
    OrderSchema,
  ) as unknown as Model<OrderDocument>;
  const repository = new OrdersRepository(OrderModel);

  let captured: { op: string; filter: any; update?: any; options: any };

  beforeEach(() => {
    jest.spyOn(Query.prototype, "exec").mockImplementation(function (
      this: any,
    ) {
      this._castConditions();
      expect(this.error()).toBeFalsy();
      captured = {
        op: this.op,
        filter: this.getFilter(),
        update: this._update ? this._castUpdate(this._update) : undefined,
        options: this.getOptions(),
      };
      return Promise.resolve([]);
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it("finds unpaid holds past the window, leaving out ones checked recently unless past the maximum, unchecked first", async () => {
    const createdBefore = new Date("2026-03-01T10:00:00Z");
    const checkedBefore = new Date("2026-03-01T10:25:00Z");
    const maxHoldBefore = new Date("2026-02-28T10:30:00Z");
    const productId = new Types.ObjectId();

    await repository.findStalePendingPaymentOrders({
      createdBefore,
      checkedBefore,
      maxHoldBefore,
      limit: 20,
      productIds: [productId],
    });

    expect(captured.op).toBe("find");
    expect(captured.filter).toEqual({
      status: OrderStatus.PENDING_PAYMENT,
      createdAt: { $lt: createdBefore },
      $or: [
        { stockHoldCheckedAt: null },
        { stockHoldCheckedAt: { $lt: checkedBefore } },
        { createdAt: { $lt: maxHoldBefore } },
      ],
      "items.productId": { $in: [productId, String(productId)] },
    });
    expect(captured.options).toMatchObject({
      sort: { stockHoldCheckedAt: 1, createdAt: 1 },
      limit: 20,
    });
  });

  it("marks a hold as checked only while the order is still unpaid", async () => {
    const orderId = new Types.ObjectId();
    const checkedAt = new Date("2026-03-01T10:30:00Z");

    await repository.markStockHoldChecked(orderId, checkedAt);

    expect(captured.filter).toEqual({
      _id: orderId,
      status: OrderStatus.PENDING_PAYMENT,
    });
    expect(captured.update.$set).toEqual({ stockHoldCheckedAt: checkedAt });
  });

  it("keeps the check time on the order", () => {
    expect(OrderSchema.path("stockHoldCheckedAt")).toBeDefined();
  });
});
