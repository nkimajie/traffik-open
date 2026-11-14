import { Logger } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Types } from "mongoose";
import { OrdersService } from "./orders.service";
import { OrdersRepository } from "../repositories/orders.repository";
import { OrderStatus } from "../enums/order.enum";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { CartsService } from "src/modules/carts/services/carts.service";
import { AddressesService } from "src/modules/addresses/services/addresses.service";
import { EmailService } from "src/modules/shared/services/email/email.service";
import { UsersRepository } from "src/modules/users/repositories/users.repository";
import { ProductsRepository } from "src/modules/products/repositories/products.repository";
import { VendorsRepository } from "src/modules/vendors/repositories/vendors.repository";
import { KashiaService } from "src/modules/escrow/services/kashia.service";
import { PlatformSettingsService } from "src/modules/admin/services/platform-settings.service";
import { OrderRefundReason } from "../enums/order-refund.enum";
import { RefundPayoutReferencesRepository } from "../repositories/refund-payout-references.repository";
import { TransactionsService } from "src/modules/shared/services/transactions/transactions.service";

describe("OrdersService payment transitions", () => {
  const orderId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  const pendingPaymentOrder = () => ({
    _id: orderId,
    userId,
    orderRef: "TRF-ABC123",
    status: OrderStatus.PENDING_PAYMENT,
    total: 1500,
    items: [
      { productId: new Types.ObjectId(), quantity: 2, price: 750, total: 1500 },
    ],
    stockReserved: true,
    stockCommitted: false,
    timeline: [],
  });

  let service: OrdersService;
  let ordersRepository: {
    query: jest.Mock;
    update: jest.Mock;
    transitionStatus: jest.Mock;
    addRefund: jest.Mock;
    completeRefundFromProvider: jest.Mock;
  };
  let cartsService: { clearCart: jest.Mock };
  let emailService: { sendSafe: jest.Mock };
  let usersRepository: { query: jest.Mock };
  let vendorsRepository: { query: jest.Mock };
  let productsModel: { updateOne: jest.Mock; find: jest.Mock };

  beforeEach(async () => {
    ordersRepository = {
      query: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      transitionStatus: jest.fn(),
      addRefund: jest.fn().mockResolvedValue(true),
      completeRefundFromProvider: jest.fn().mockResolvedValue(null),
    };
    cartsService = {
      clearCart: jest.fn().mockResolvedValue({ failed: false }),
    };
    emailService = { sendSafe: jest.fn().mockResolvedValue(undefined) };
    usersRepository = {
      query: jest.fn().mockResolvedValue({
        _id: userId,
        email: "shopper@example.com",
        firstName: "Ada",
      }),
    };
    vendorsRepository = { query: jest.fn().mockResolvedValue(null) };
    productsModel = {
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      find: jest.fn().mockReturnValue({
        select: () => ({ lean: () => Promise.resolve([]) }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        UtilsService,
        { provide: OrdersRepository, useValue: ordersRepository },
        { provide: CartsService, useValue: cartsService },
        { provide: AddressesService, useValue: {} },
        { provide: EmailService, useValue: emailService },
        { provide: UsersRepository, useValue: usersRepository },
        { provide: ProductsRepository, useValue: { model: productsModel } },
        { provide: VendorsRepository, useValue: vendorsRepository },
        { provide: KashiaService, useValue: {} },
        { provide: PlatformSettingsService, useValue: {} },
        { provide: RefundPayoutReferencesRepository, useValue: {} },
        {
          // A server without transactions: the work runs as it is.
          provide: TransactionsService,
          useValue: { run: (work: () => Promise<unknown>) => work() },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe("confirmOrderPayment", () => {
    it("moves the order to PENDING with one conditional update, then clears the cart and notifies", async () => {
      const order = pendingPaymentOrder();
      const confirmed = { ...order, status: OrderStatus.PENDING };
      ordersRepository.query.mockResolvedValue(order);
      ordersRepository.transitionStatus.mockResolvedValue(confirmed);

      const result = await service.confirmOrderPayment(String(orderId), {
        escrowId: "esc_1",
        escrowStatus: "active",
        paymentReference: "PL-1",
        amountKobo: 150000,
      });

      expect(result.failed).toBe(false);
      expect(result.description).toBe("Payment confirmed");
      expect(ordersRepository.transitionStatus).toHaveBeenCalledWith(
        orderId,
        OrderStatus.PENDING_PAYMENT,
        {
          $set: {
            status: OrderStatus.PENDING,
            stockReserved: false,
            stockCommitted: true,
            escrowId: "esc_1",
            escrowStatus: "active",
            paymentReference: "PL-1",
          },
          $push: {
            timeline: expect.objectContaining({
              status: OrderStatus.PENDING,
              description: "Payment confirmed",
            }),
          },
        },
        false,
        // Refused in the same update if Kashia already returned this money.
        { providerRefundedEscrowIds: { $ne: "esc_1" } },
        undefined, // no transaction on a server without them
      );
      expect(cartsService.clearCart).toHaveBeenCalledWith(String(userId));
      // Notifications are awaited (not fire-and-forget) before returning.
      expect(emailService.sendSafe).toHaveBeenCalledWith(
        expect.objectContaining({ to: "shopper@example.com" }),
      );
    });

    it("treats losing the race to a concurrent confirmation as already confirmed (no second email)", async () => {
      const order = pendingPaymentOrder();
      ordersRepository.query
        .mockResolvedValueOnce(order) // initial read: still awaiting payment
        .mockResolvedValueOnce({ ...order, status: OrderStatus.PENDING }); // re-read after the lost race
      ordersRepository.transitionStatus.mockResolvedValue(null);

      const result = await service.confirmOrderPayment(String(orderId), {
        escrowId: "esc_1",
      });

      expect(result.failed).toBe(false);
      expect(result.description).toBe("Payment already confirmed");
      expect(cartsService.clearCart).not.toHaveBeenCalled();
      expect(emailService.sendSafe).not.toHaveBeenCalled();
    });

    it("is idempotent for a redelivered confirmation of a paid order", async () => {
      ordersRepository.query.mockResolvedValue({
        ...pendingPaymentOrder(),
        status: OrderStatus.PENDING,
      });

      const result = await service.confirmOrderPayment(String(orderId));

      expect(result).toMatchObject({
        failed: false,
        description: "Payment already confirmed",
        code: 200,
      });
      expect(ordersRepository.transitionStatus).not.toHaveBeenCalled();
      expect(ordersRepository.addRefund).not.toHaveBeenCalled();
    });

    it("records the escrow on a cancelled order and flags it for refund instead of confirming", async () => {
      ordersRepository.query.mockResolvedValue({
        ...pendingPaymentOrder(),
        status: OrderStatus.CANCELLED,
      });
      const errorLog = jest.spyOn(Logger.prototype, "error");

      const result = await service.confirmOrderPayment(String(orderId), {
        escrowId: "esc_1",
        escrowStatus: "active",
        paymentReference: "PL-1",
      });

      expect(result).toMatchObject({ failed: true, code: 409 });
      expect(ordersRepository.transitionStatus).not.toHaveBeenCalled();
      // Recorded only if the order has no escrow of its own.
      expect(ordersRepository.update).toHaveBeenCalledWith(
        { _id: orderId, escrowId: null },
        { escrowId: "esc_1", escrowStatus: "active", paymentReference: "PL-1" },
      );
      expect(String(errorLog.mock.calls[0][0])).toMatch(
        /cancelled order TRF-ABC123 .*esc_1.*manual refund required/,
      );
      expect(ordersRepository.addRefund).toHaveBeenCalledWith(orderId, {
        reason: OrderRefundReason.PAID_AFTER_CANCELLATION,
        amount: 1500,
        escrowId: "esc_1",
        paymentReference: "PL-1",
      });
      // ...then closes it at once if Kashia already reported it refunded.
      expect(ordersRepository.completeRefundFromProvider).toHaveBeenCalledWith(
        orderId,
        { escrowId: "esc_1" },
        { onlyIfProviderRefunded: "esc_1" },
      );
      expect(emailService.sendSafe).not.toHaveBeenCalled();
    });

    it("warns when the amount Kashia reports differs from the order total", async () => {
      const order = pendingPaymentOrder();
      ordersRepository.query.mockResolvedValue(order);
      ordersRepository.transitionStatus.mockResolvedValue({
        ...order,
        status: OrderStatus.PENDING,
      });
      const warnLog = jest.spyOn(Logger.prototype, "warn");

      await service.confirmOrderPayment(String(orderId), { amountKobo: 100 });

      expect(String(warnLog.mock.calls[0][0])).toMatch(
        /100 kobo .*150000 kobo/,
      );
    });

    it("returns 404 for an unknown order", async () => {
      ordersRepository.query.mockResolvedValue(null);

      await expect(
        service.confirmOrderPayment(String(orderId)),
      ).resolves.toMatchObject({
        failed: true,
        code: 404,
      });
    });
  });

  describe("cancelPendingPaymentOrder", () => {
    it("cancels atomically first, then returns the reserved stock", async () => {
      const order = pendingPaymentOrder();
      const calls: string[] = [];
      ordersRepository.transitionStatus.mockImplementation(async () => {
        calls.push("transition");
        return order; // pre-image
      });
      productsModel.updateOne.mockImplementation(async () => {
        calls.push("release-stock");
        return { modifiedCount: 1 };
      });
      ordersRepository.query
        .mockResolvedValueOnce(order) // still awaiting payment
        .mockResolvedValue({ ...order, status: OrderStatus.CANCELLED });

      const result = await service.cancelPendingPaymentOrder(
        String(orderId),
        "Payment link expired",
        { escrowStatus: "expired" },
      );

      expect(result).toMatchObject({
        failed: false,
        description: "Pending payment order cancelled",
      });
      expect(ordersRepository.transitionStatus).toHaveBeenCalledWith(
        orderId,
        OrderStatus.PENDING_PAYMENT,
        {
          $set: {
            status: OrderStatus.CANCELLED,
            stockReserved: false,
            stockCommitted: false,
            escrowStatus: "expired",
          },
          $push: {
            timeline: expect.objectContaining({
              status: OrderStatus.CANCELLED,
              description: "Payment link expired",
            }),
          },
        },
        false,
        {},
        undefined, // no transaction on a server without them
      );
      expect(calls).toEqual(["transition", "release-stock"]);
      expect(productsModel.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: order.items[0].productId }),
        { $inc: { "defaultVariation.quantity": 2 } },
        { session: undefined },
      );
    });

    it("does nothing when the order was paid between the read and the update", async () => {
      ordersRepository.transitionStatus.mockResolvedValue(null);
      ordersRepository.query
        .mockResolvedValueOnce(pendingPaymentOrder())
        .mockResolvedValue({
          ...pendingPaymentOrder(),
          status: OrderStatus.PENDING,
        });

      const result = await service.cancelPendingPaymentOrder(
        String(orderId),
        "expired",
      );

      expect(result).toMatchObject({
        failed: false,
        description: "Order is not awaiting payment",
      });
      expect(productsModel.updateOne).not.toHaveBeenCalled();
    });

    it("does not return stock twice if the order no longer holds any", async () => {
      ordersRepository.transitionStatus.mockResolvedValue({
        ...pendingPaymentOrder(),
        stockReserved: false,
        stockCommitted: false,
      });
      ordersRepository.query.mockResolvedValue(pendingPaymentOrder());

      await service.cancelPendingPaymentOrder(String(orderId), "expired");

      expect(ordersRepository.transitionStatus).toHaveBeenCalled();
      expect(productsModel.updateOne).not.toHaveBeenCalled();
    });

    it("returns 404 for an unknown order", async () => {
      ordersRepository.transitionStatus.mockResolvedValue(null);
      ordersRepository.query.mockResolvedValue(null);

      await expect(
        service.cancelPendingPaymentOrder(String(orderId), "expired"),
      ).resolves.toMatchObject({ failed: true, code: 404 });
    });
  });

  describe("updateOrderEscrowFields", () => {
    it("can be restricted to a current order status", async () => {
      await service.updateOrderEscrowFields(
        String(orderId),
        { escrowStatus: "pending" },
        { onlyIfOrderStatus: OrderStatus.PENDING_PAYMENT },
      );

      expect(ordersRepository.update).toHaveBeenCalledWith(
        { _id: orderId, status: OrderStatus.PENDING_PAYMENT },
        { escrowStatus: "pending" },
      );
    });
  });
});
