import {
  CompleteOrderRefundValidation,
  ReopenOrderRefundValidation,
  ResolvePaymentAlertValidation,
} from "./complete-refund.validation";
import { normalizePayoutReference } from "../utils/order-refund.util";

describe("refund validations", () => {
  const valid = { method: "BANK_TRANSFER", reference: "FT-0001", amount: 2000 };

  it("accepts complete evidence and trims it", () => {
    const { error, value } = CompleteOrderRefundValidation.validate({
      ...valid,
      reference: "  FT-0001 ",
      note: " ok ",
    });
    expect(error).toBeUndefined();
    expect(value).toMatchObject({ reference: "FT-0001", note: "ok" });
  });

  it.each([
    ["no method", { method: undefined }],
    ["an unknown method", { method: "CASH_IN_HAND" }],
    ["no reference", { reference: undefined }],
    ["a blank reference", { reference: "   " }],
    ["a too-short reference", { reference: "x1" }],
    ["no amount", { amount: undefined }],
    ["a zero amount", { amount: 0 }],
    ["fractions of a kobo", { amount: 20.001 }],
    ["an amount sent as text", { amount: "2000" }],
  ])("rejects %s", (_label, change) => {
    const { error } = CompleteOrderRefundValidation.validate({
      ...valid,
      ...change,
    });
    expect(error).toBeDefined();
  });

  it("requires a reason to reopen", () => {
    expect(ReopenOrderRefundValidation.validate({}).error).toBeDefined();
    expect(
      ReopenOrderRefundValidation.validate({ reason: "oops" }).error,
    ).toBeDefined();
    expect(
      ReopenOrderRefundValidation.validate({ reason: "Marked by mistake" })
        .error,
    ).toBeUndefined();
  });

  it("requires a note to resolve a payment alert", () => {
    expect(ResolvePaymentAlertValidation.validate({}).error).toBeDefined();
    expect(
      ResolvePaymentAlertValidation.validate({ note: "   ok  " }).error,
    ).toBeDefined();
    const { error, value } = ResolvePaymentAlertValidation.validate({
      note: "  Recovered from the store  ",
    });
    expect(error).toBeUndefined();
    expect(value.note).toBe("Recovered from the store");
  });

  it("normalises references so spacing and case cannot disguise a reused one", () => {
    expect(normalizePayoutReference(" ft 0001/ab ")).toBe(
      normalizePayoutReference("FT0001/AB"),
    );
  });
});
