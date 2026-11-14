import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { ClientSession, Model, Types } from "mongoose";
import { BaseRepository } from "src/modules/shared/base/repository.base";
import { Cart, CartDocument } from "../schemas/cart.schema";

@Injectable()
export class CartsRepository extends BaseRepository<CartDocument> {
  constructor(@InjectModel(Cart.name) private cartModel: Model<CartDocument>) {
    super(cartModel);
  }

  /**
   * Takes the shopper's checkout lock if it is free or expired, in one atomic
   * update. Returns the lock token, or null if another checkout holds it (or
   * the shopper has no cart).
   */
  async acquireCheckoutLock(
    userId: Types.ObjectId,
    ttlMs: number,
  ): Promise<string | null> {
    const now = new Date();
    const token = randomUUID();

    const locked = await this.cartModel.findOneAndUpdate(
      {
        userId,
        $or: [
          { checkoutLockedUntil: { $exists: false } },
          { checkoutLockedUntil: null },
          { checkoutLockedUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          checkoutLockToken: token,
          checkoutLockedUntil: new Date(now.getTime() + ttlMs),
        },
      },
      { new: true },
    );

    return locked ? token : null;
  }

  /**
   * Confirms this caller still holds the lock (it may have expired and been
   * taken by another checkout) and extends it. Run inside the transaction
   * that saves the order, so a checkout that lost its lock saves nothing.
   */
  async confirmCheckoutLock(
    userId: Types.ObjectId,
    token: string,
    ttlMs: number,
    session?: ClientSession,
  ): Promise<boolean> {
    const result = await this.cartModel.updateOne(
      { userId, checkoutLockToken: token },
      { $set: { checkoutLockedUntil: new Date(Date.now() + ttlMs) } },
      { session },
    );
    return result.matchedCount > 0;
  }

  /** Releases the lock only if this caller still owns it. */
  async releaseCheckoutLock(
    userId: Types.ObjectId,
    token: string,
  ): Promise<void> {
    await this.cartModel.updateOne(
      { userId, checkoutLockToken: token },
      { $unset: { checkoutLockToken: "", checkoutLockedUntil: "" } },
    );
  }
}
