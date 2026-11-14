"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OrderStatusBadge from "@/components/account/order-status-badge";
import OrderRefunds from "@/components/account/order-refunds";
import {
  useCancelOrderMutation,
  useConfirmOrderDeliveryMutation,
  useCreateOrderPaymentLinkMutation,
  useOrderQuery,
  useReportRefundNotReceivedMutation,
} from "@/lib/services/api/shopper/use-orders.api";
import { DetailSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import { formatNaira } from "@/lib/utils/format-price";
import {
  formatOrderDate,
  formatOrderNumber,
  getDeliveryMethodLabel,
  getOrderItemImage,
  getOrderItemName,
  getOrderItemVendorId,
  getOrderItemVendorName,
  getOrderStatusLabel,
  getOutstandingRefunds,
} from "@/lib/utils/order";
import useToastAlert from "@/lib/hooks/use-toast-alert";
import type { OrderRefund } from "@/lib/types/api";

type OrderDetailContentProps = {
  params: { id: string };
};

export default function OrderDetailContent({ params }: OrderDetailContentProps) {
  const { data: order, isLoading, error, refetch } = useOrderQuery(params.id);
  const cancelOrderMutation = useCancelOrderMutation();
  const confirmDeliveryMutation = useConfirmOrderDeliveryMutation();
  const createPaymentLinkMutation = useCreateOrderPaymentLinkMutation();
  const reportRefundMutation = useReportRefundNotReceivedMutation();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundToReport, setRefundToReport] = useState<OrderRefund | null>(
    null,
  );
  const { handleSuccessToast, handleErrorToast } = useToastAlert();

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error || !order) {
    return (
      <ErrorState
        title="Order not found"
        message="We couldn't load this order. It may have been removed."
        onRetry={() => refetch()}
      />
    );
  }

  const canCancel =
    order.status === "PENDING_PAYMENT" || order.status === "PENDING";
  const canPayNow = order.status === "PENDING_PAYMENT";
  // Only a paid order has money to return; an unpaid one was never charged.
  const isPaid = order.status !== "PENDING_PAYMENT";
  const canConfirmDelivery = order.status === "SHIPPED";
  const timeline = order.timeline ?? [];

  function handlePayNow() {
    createPaymentLinkMutation.mutate(params.id, {
      onSuccess: (updatedOrder) => {
        if (updatedOrder.paymentUrl) {
          window.location.href = updatedOrder.paymentUrl;
          return;
        }
        handleErrorToast({
          description: "Payment link was created but no checkout URL was returned.",
        });
      },
      onError: () => {
        handleErrorToast({
          description: "Could not start payment. Please try again.",
        });
      },
    });
  }

  function handleConfirmDelivery() {
    confirmDeliveryMutation.mutate(params.id, {
      onSuccess: () => {
        handleSuccessToast({
          description: "Delivery confirmed. Thank you for shopping!",
        });
      },
      onError: () => {
        handleErrorToast({
          description: "Could not confirm delivery. Please try again.",
        });
      },
    });
  }

  function handleCancel() {
    cancelOrderMutation.mutate(params.id, {
      onSuccess: (cancelledOrder) => {
        setCancelOpen(false);
        handleSuccessToast({
          description:
            getOutstandingRefunds(cancelledOrder).length > 0
              ? "Order cancelled. Your refund has been requested — you can follow it on this page."
              : "Order cancelled.",
        });
      },
      onError: () => {
        handleErrorToast({
          description: "Could not cancel this order. Please try again.",
        });
      },
    });
  }

  function handleReportRefund() {
    if (!refundToReport) return;
    reportRefundMutation.mutate(
      { orderId: params.id, refundId: refundToReport._id },
      {
        onSuccess: () => {
          setRefundToReport(null);
          handleSuccessToast({
            description:
              "Thanks for letting us know. We'll check the refund and get back to you.",
          });
        },
        onError: () => {
          handleErrorToast({
            description:
              "Could not report the refund. Please try again or contact support.",
          });
        },
      },
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/account/orders"
            className="text-sm font-medium text-traffik-pink hover:underline"
          >
            ← Back to orders
          </Link>
          <h2 className="mt-2 text-lg font-bold text-[#030803] sm:text-xl">
            Order #{formatOrderNumber(order)}
          </h2>
          <p className="mt-1 text-sm text-[#484848]">
            Placed on {formatOrderDate(order.createdAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-[#030803]">Order timeline</h3>
            {timeline.length === 0 ? (
              <p className="mt-4 text-sm text-[#484848]">
                {getOrderStatusLabel(order.status)}
              </p>
            ) : (
              <ol className="mt-4 space-y-0">
                {timeline.map((entry, index, arr) => (
                  <li key={`${entry.status}-${entry.date}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`h-3 w-3 rounded-full ${
                          index === arr.length - 1
                            ? "bg-traffik-pink"
                            : "bg-traffik-green"
                        }`}
                      />
                      {index < arr.length - 1 && (
                        <span className="min-h-8 w-px flex-1 bg-gray-200" />
                      )}
                    </div>
                    <div className="pb-6">
                      <p className="font-medium text-[#030803]">
                        {getOrderStatusLabel(entry.status)}
                      </p>
                      <p className="mt-0.5 text-sm text-[#484848]">
                        {entry.description}
                      </p>
                      <p className="mt-1 text-xs text-[#484848]/70">
                        {formatOrderDate(entry.date)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <OrderRefunds
            refunds={order.refunds}
            onReportNotReceived={setRefundToReport}
            reportingDisabled={reportRefundMutation.isPending}
          />

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-[#030803]">Items</h3>
            <ul className="mt-4 divide-y divide-gray-100">
              {order.items.map((item) => (
                <li
                  key={`${item.productId}-${item.variationId ?? "default"}`}
                  className="flex gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    <Image
                      src={getOrderItemImage(item, item.productId)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${item.productId}`}
                      className="font-medium text-[#030803] hover:text-traffik-pink"
                    >
                      {getOrderItemName(item)}
                    </Link>
                    {getOrderItemVendorId(item) ? (
                      <Link
                        href={`/stores/${getOrderItemVendorId(item)}`}
                        className="mt-0.5 block text-xs text-[#484848] hover:text-traffik-pink"
                      >
                        {getOrderItemVendorName(item)}
                      </Link>
                    ) : null}
                    <p className="mt-1 text-sm text-[#484848]">
                      Qty {item.quantity} × {formatNaira(item.price)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-[#030803]">
                    {formatNaira(item.total)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <h3 className="font-semibold text-[#030803]">Delivery</h3>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[#484848]">
              <Truck className="h-4 w-4 text-traffik-amber" aria-hidden />
              {getDeliveryMethodLabel(order.deliveryMethod)}
            </p>
            <div className="mt-3 text-sm text-[#484848]">
              <p className="font-medium text-[#030803]">
                {order.shippingAddress.fullName}
              </p>
              <p className="mt-1">
                {order.shippingAddress.streetAddress}
                {order.shippingAddress.landmark &&
                  `, ${order.shippingAddress.landmark}`}
              </p>
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                {order.shippingAddress.zipCode}
              </p>
              <p className="mt-1">{order.shippingAddress.phone}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-[#030803]">Summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between text-[#484848]">
                <dt>Subtotal</dt>
                <dd>{formatNaira(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-traffik-green">
                  <dt>Discount</dt>
                  <dd>-{formatNaira(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-[#484848]">
                <dt>Shipping</dt>
                <dd>{formatNaira(order.shippingFee)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 font-bold text-[#030803]">
                <dt>Total</dt>
                <dd>{formatNaira(order.total)}</dd>
              </div>
            </dl>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-[#484848]">
              <ShieldCheck className="h-3.5 w-3.5 text-traffik-green" aria-hidden />
              Kashia escrow protected
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {canPayNow && (
              <Button
                className="rounded-xl bg-traffik-pink hover:bg-traffik-pink/90"
                onClick={handlePayNow}
                disabled={createPaymentLinkMutation.isPending}
              >
                {createPaymentLinkMutation.isPending ? "Starting payment…" : "Pay now"}
              </Button>
            )}
            {canConfirmDelivery && (
              <Button
                className="rounded-xl bg-traffik-green text-white hover:bg-traffik-green/90"
                onClick={handleConfirmDelivery}
                disabled={confirmDeliveryMutation.isPending}
              >
                Confirm delivery received
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => setCancelOpen(true)}
                disabled={cancelOrderMutation.isPending}
              >
                Cancel order
              </Button>
            )}
            <Button variant="outline" className="rounded-xl" disabled>
              Leave a review — coming soon
            </Button>
          </div>
        </aside>
      </div>

      <Dialog
        open={refundToReport !== null}
        onOpenChange={(open) => {
          if (!open) setRefundToReport(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund not received?</DialogTitle>
            <DialogDescription>
              {refundToReport?.payout
                ? `We recorded ${formatNaira(refundToReport.amount)} as sent (${refundToReport.payout.reference}). Bank transfers can take a few working days. If it still hasn't arrived, we'll check the payment and get back to you.`
                : "We'll check the payment and get back to you."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundToReport(null)}>
              Not now
            </Button>
            <Button
              onClick={handleReportRefund}
              disabled={reportRefundMutation.isPending}
            >
              Report not received
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              {isPaid
                ? "Your payment held in escrow will be refunded to you. This action cannot be undone."
                : "You haven't been charged for this order. This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep order
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelOrderMutation.isPending}
            >
              Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
