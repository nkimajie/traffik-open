"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { resolveAdminPaymentAlert } from "@/lib/services/api/admin/admin.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import { formatOrderDate, getPaymentAlertLabel } from "@/lib/utils/order";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import useToastAlert from "@/lib/hooks/use-toast-alert";
import type { Order, OrderPaymentAlert } from "@/lib/types/api";

/**
 * Where an order and its Kashia escrow disagree (a dispute, money released
 * for a cancelled order, a payment returned after shipping, ...), with a way
 * to record how each was dealt with.
 */
export default function AdminOrderPaymentAlerts({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();
  const [resolving, setResolving] = useState<OrderPaymentAlert | null>(null);
  const [note, setNote] = useState("");

  const resolveMutation = useMutation({
    mutationFn: (alert: OrderPaymentAlert) =>
      resolveAdminPaymentAlert(order._id, alert._id, { note: note.trim() }),
    onSuccess: () => {
      handleSuccessToast({ description: "Alert resolved." });
      setResolving(null);
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.ADMIN_ORDERS] });
    },
    onError: (err: Error) => handleErrorToast({ description: err.message }),
  });

  const alerts = order.paymentAlerts ?? [];
  if (!alerts.length) return null;

  return (
    <>
      <ul className="mt-2 space-y-2">
        {alerts.map((alert) => {
          const open = !alert.resolvedAt;
          return (
            <li
              key={alert._id}
              className={`rounded-lg border p-3 text-xs ${
                open
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-gray-200 bg-gray-50 text-[#484848]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {open ? (
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-traffik-green"
                    aria-hidden
                  />
                )}
                <span className="font-medium">
                  {getPaymentAlertLabel(alert.type)}
                </span>
                <span>
                  · {formatOrderDate(alert.raisedAt)}
                  {alert.escrowId ? ` · escrow ${alert.escrowId}` : ""}
                </span>
                {open ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 bg-white"
                    onClick={() => {
                      setNote("");
                      setResolving(alert);
                    }}
                  >
                    Resolve
                  </Button>
                ) : null}
              </div>
              <p className="mt-1">{alert.message}</p>
              {!open && alert.resolutionNote ? (
                <p className="mt-1">
                  Resolved {formatOrderDate(alert.resolvedAt)}:{" "}
                  {alert.resolutionNote}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Dialog
        open={resolving !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setResolving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve this alert?</DialogTitle>
            <DialogDescription>
              {resolving
                ? `${getPaymentAlertLabel(resolving.type)}: ${resolving.message}`
                : null}
            </DialogDescription>
          </DialogHeader>
          <Input
            label="What was done?"
            placeholder="e.g. Recovered the amount from the store's next payout"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)}>
              Cancel
            </Button>
            <Button
              disabled={note.trim().length < 5 || resolveMutation.isPending}
              onClick={() => resolving && resolveMutation.mutate(resolving)}
            >
              Resolve alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
