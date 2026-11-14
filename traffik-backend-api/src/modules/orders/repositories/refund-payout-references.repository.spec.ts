import { Model, Types } from "mongoose";
import { RefundPayoutReferencesRepository } from "./refund-payout-references.repository";
import { RefundPayoutReferenceDocument } from "../schemas/refund-payout-reference.schema";
import { RefundPayoutReferenceSchema } from "../schemas/refund-payout-reference.schema";

describe("RefundPayoutReferencesRepository", () => {
  const orderId = new Types.ObjectId();
  const refundId = new Types.ObjectId();
  const duplicateKey = Object.assign(new Error("E11000 duplicate key"), {
    code: 11000,
  });

  const build = (model: Record<string, jest.Mock>) =>
    new RefundPayoutReferencesRepository(
      model as unknown as Model<RefundPayoutReferenceDocument>,
    );
  const completionId = new Types.ObjectId();

  it("relies on a unique index on the reference", () => {
    expect(
      RefundPayoutReferenceSchema.path("referenceKey").options,
    ).toMatchObject({ unique: true, required: true });
  });

  it("claims a reference no one holds, for this completion", async () => {
    const model = { create: jest.fn().mockResolvedValue({}) };

    await expect(
      build(model).claim("FT1", orderId, refundId, completionId),
    ).resolves.toBe(true);
    expect(model.create).toHaveBeenCalledWith({
      referenceKey: "FT1",
      orderId,
      refundId,
      completionId,
    });
  });

  it("lets the same refund claim its own reference again, moving it to the new completion", async () => {
    const model = {
      create: jest.fn().mockRejectedValue(duplicateKey),
      findOneAndUpdate: jest.fn().mockResolvedValue({ referenceKey: "FT1" }),
    };

    await expect(
      build(model).claim("FT1", orderId, refundId, completionId),
    ).resolves.toBe(true);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { referenceKey: "FT1", orderId, refundId },
      { $set: { completionId } },
    );
  });

  it("refuses a reference held by another refund", async () => {
    const model = {
      create: jest.fn().mockRejectedValue(duplicateKey),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
    };

    await expect(
      build(model).claim("FT1", orderId, refundId, completionId),
    ).resolves.toBe(false);
  });

  it("does not treat other database errors as a clash", async () => {
    const model = { create: jest.fn().mockRejectedValue(new Error("down")) };

    await expect(
      build(model).claim("FT1", orderId, refundId, completionId),
    ).rejects.toThrow("down");
  });

  it("only releases a reference still held by that completion", async () => {
    const model = { deleteOne: jest.fn().mockResolvedValue({}) };

    await build(model).release("FT1", orderId, refundId, completionId);

    expect(model.deleteOne).toHaveBeenCalledWith({
      referenceKey: "FT1",
      orderId,
      refundId,
      completionId,
    });
  });
});
