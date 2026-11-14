import mongoose, { ClientSession, Model, Query, Types } from "mongoose";
import { CartsRepository } from "./carts.repository";
import { CartDocument, CartSchema } from "../schemas/cart.schema";

/** The checkout-lock check against the real Cart schema (cast, not sent). */
describe("CartsRepository.confirmCheckoutLock (cast against the Cart schema)", () => {
  const CartModel = mongoose.model(
    "CartLockCastSpec",
    CartSchema,
  ) as unknown as Model<CartDocument>;
  const repository = new CartsRepository(CartModel);

  afterEach(() => jest.restoreAllMocks());

  it("matches only while this checkout holds the lock, extends it, and joins the transaction", async () => {
    let captured: { filter: any; update: any; options: any } | undefined;
    jest.spyOn(Query.prototype, "exec").mockImplementation(function (
      this: any,
    ) {
      this._castConditions();
      expect(this.error()).toBeFalsy();
      captured = {
        filter: this.getFilter(),
        update: this._castUpdate(this._update),
        options: this.getOptions(),
      };
      return Promise.resolve({ matchedCount: 0 });
    });
    const userId = new Types.ObjectId();
    const session = { id: "txn" } as unknown as ClientSession;

    const held = await repository.confirmCheckoutLock(
      userId,
      "token-1",
      30_000,
      session,
    );

    expect(held).toBe(false);
    expect(captured!.filter).toEqual({ userId, checkoutLockToken: "token-1" });
    const until = captured!.update.$set.checkoutLockedUntil as Date;
    expect(until.getTime()).toBeGreaterThan(Date.now() + 29_000);
    expect(captured!.options.session).toEqual(session);
  });
});
