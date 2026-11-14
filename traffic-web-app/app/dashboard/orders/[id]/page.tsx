"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/context/providers/auth-provider";
import { fetchVendorOrderById } from "@/lib/services/api/shopper/shopper.api";
import { useUpdateVendorOrderStatusMutation } from "@/lib/services/api/shopper/use-orders.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import OrderStatusBadge from "@/components/account/order-status-badge";
import {
  formatOrderDate,
  formatOrderNumber,
  getDeliveryMethodLabel,
  getOrderStatusLabel,
} from "@/lib/utils/order";
import { formatNaira } from "@/lib/utils/format-price";
import { DetailSkeleton } from "@/components/ui/list-skeletons";
import { ErrorState } from "@/components/ui/error-state";
import useToastAlert from "@/lib/hooks/use-toast-alert";
import type { OrderStatus } from "@/lib/types/api";

type VendorOrderDetailPageProps = {
  params: { id: string };
};

export default function VendorOrderDetailPage({
  params,
}: VendorOrderDetailPageProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const updateStatusMutation = useUpdateVendorOrderStatusMutation();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: [QueryKeys.VENDOR_ORDERS, params.id] as const,
    queryFn: () => fetchVendorOrderById(params.id),
    enabled: isAuthenticated && !!params.id,
  });

  if (authLoading || isLoading) {
    return (
      <div className="p-8">
        <DetailSkeleton />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error || !order) {
    return (
      <div className="p-8">
        <ErrorState
          title="Order not found"
          message="We couldn't load this order."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const timeline = order.timeline ?? [];
  const status = order.status as OrderStatus;

  function updateStatus(nextStatus: OrderStatus, description: string) {
    updateStatusMutation.mutate(
      { orderId: params.id, status: nextStatus, description },
      {
        onSuccess: () => {
          handleSuccessToast({ description: "Order updated." });
          refetch();
        },
        onError: () => {
          handleErrorToast({ description: "Could not update this order." });
        },
      },
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/dashboard/orders"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to orders
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Order #{formatOrderNumber(order)}
            </h1>
            {order.createdAt && (
              <p className="mt-1 text-sm text-gray-600">
                Placed on {formatOrderDate(order.createdAt)}
              </p>
            )}
          </div>
          <OrderStatusBadge status={status} />
        </div>

        {(status === "PENDING" || status === "ACCEPTED") && (
          <div className="mt-4 flex flex-wrap gap-3">
            {status === "PENDING" && (
              <>
                <Button
                  onClick={() =>
                    updateStatus("ACCEPTED", "Order accepted by store")
                  }
                  disabled={updateStatusMutation.isPending}
                >
                  Accept order
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    updateStatus("REJECTED", "Order declined by store")
                  }
                  disabled={updateStatusMutation.isPending}
                >
                  Decline
                </Button>
              </>
            )}
            {status === "ACCEPTED" && (
              <Button
                onClick={() => updateStatus("SHIPPED", "Order marked as shipped")}
                disabled={updateStatusMutation.isPending}
              >
                Mark as shipped
              </Button>
            )}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {timeline.length > 0 && (
              <section className="rounded-lg border border-gray-200 bg-white p-5">
                <h2 className="font-semibold text-gray-900">Order timeline</h2>
                <ol className="mt-4 space-y-0">
                  {timeline.map((entry, index, arr) => (
                    <li
                      key={`${entry.status}-${entry.date}`}
                      className="flex gap-3"
                    >
                      <div className="flex flex-col items-center">
                        <span
                          className={`h-3 w-3 rounded-full ${
                            index === arr.length - 1
                              ? "bg-blue-600"
                              : "bg-green-500"
                          }`}
                        />
                        {index < arr.length - 1 && (
                          <span className="min-h-8 w-px flex-1 bg-gray-200" />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className="font-medium text-gray-900">
                          {getOrderStatusLabel(entry.status as OrderStatus)}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-600">
                          {entry.description}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatOrderDate(entry.date)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="font-semibold text-gray-900">Your items</h2>
              <ul className="mt-4 divide-y divide-gray-100">
                {order.items.map((item) => (
                  <li
                    key={`${item.productId}-${item.name}`}
                    className="flex gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                      <Image
                        src={
                          item.images?.[0] ??
                          "https://picsum.photos/seed/product/64/64"
                        }
                        alt=""
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        Qty {item.quantity} × {formatNaira(item.price)}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-gray-900">
                      {formatNaira(item.total)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
              <h2 className="font-semibold text-gray-900">Delivery</h2>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-600">
                <Truck className="h-4 w-4" aria-hidden />
                {getDeliveryMethodLabel(order.deliveryMethod)}
              </p>
              {order.shippingAddress && (
                <div className="mt-3 text-sm text-gray-600">
                  <p className="font-medium text-gray-900">
                    {order.shippingAddress.fullName}
                  </p>
                  <p className="mt-1">{order.shippingAddress.streetAddress}</p>
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                    {order.shippingAddress.zipCode}
                  </p>
                  <p className="mt-1">{order.shippingAddress.phone}</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="font-semibold text-gray-900">Your total</h2>
              <p className="mt-3 text-2xl font-bold text-gray-900">
                {formatNaira(order.total)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Vendor subtotal for this order
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
