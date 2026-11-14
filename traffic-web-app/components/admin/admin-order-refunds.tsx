"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  completeAdminOrderRefund,
  reopenAdminOrderRefund,
} from "@/lib/services/api/admin/admin.api";
import { QueryKeys } from "@/lib/services/config/query-keys";
import {
  formatOrderDate,
  getLatestRefundEvent,
  getRefundPayoutMethodLabel,
  getRefundReasonLabel,
} from "@/lib/utils/order";
import { formatNaira } from "@/lib/utils/format-price";
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
import type {
  Order,
  OrderRefund,
  OrderRefundPayoutMethod,
} from "@/lib/types/api";

const PAYOUT_METHODS: OrderRefundPayoutMethod[] = [
  "BANK_TRANSFER",
  "KASHIA",
  "OTHER",
];

const emptyEvidence = {
  method: "BANK_TRANSFER" as OrderRefundPayoutMethod,
  reference: "",
  amount: "",
  note: "",
};

function orderLabel(order: Order) {
  return order.orderRef ?? order._id.slice(-8).toUpperCase();
}

/** Small status chips that tell an admin what needs care on a refund. */
function RefundFlags({ refund }: { refund: OrderRefund }) {
  const latest = getLatestRefundEvent(refund);
  const doubleRefund = refund.history?.some(
    (event) => event.type === "PROVIDER_REFUNDED" && event.possibleDoubleRefund,
  );
  const chip = "rounded-full px-2 py-0.5 font-medium";
  return (
    <>
      {refund.status === "REFUNDED" ? (
        <span className={`${chip} bg-traffik-green/10 text-traffik-green`}>
          Refunded
        </span>
      ) : (
        <span className={`${chip} bg-amber-50 text-amber-700`}>
          Refund to make
        </span>
      )}
      {refund.status === "REQUIRED" &&
      latest?.type === "REOPENED" &&
      latest.actor === "SHOPPER" ? (
        <span className={`${chip} bg-red-50 text-red-700`}>
          Shopper says not received
        </span>
      ) : null}
      {doubleRefund ? (
        <span className={`${chip} bg-red-50 text-red-700`}>
          Possible double refund
        </span>
      ) : null}
      {refund.providerConfirmedAt && !doubleRefund ? (
        <span className={`${chip} bg-traffik-green/10 text-traffik-green`}>
          Confirmed by Kashia
        </span>
      ) : null}
    </>
  );
}

/** Earlier payouts on a refund that went back in the queue, so it is not paid twice by mistake. */
function PreviousPayouts({ refund }: { refund: OrderRefund }) {
  const history = refund.history ?? [];
  const payouts = history.filter(
    (event) => event.type === "COMPLETED" && event.payout,
  );
  if (refund.status !== "REQUIRED" || payouts.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="font-medium">
        Previously recorded as paid — check before paying again:
      </p>
      <ul className="mt-1 space-y-0.5">
        {payouts.map((event) => (
          <li key={event._id}>
            {formatOrderDate(event.at)} ·{" "}
            {getRefundPayoutMethodLabel(event.payout!.method)} ·{" "}
            {event.payout!.reference}
          </li>
        ))}
      </ul>
      {history
        .filter((event) => event.type === "REOPENED")
        .map((event) => (
          <p key={event._id} className="mt-1">
            Reopened by {event.actor === "SHOPPER" ? "the shopper" : "an admin"}{" "}
            on {formatOrderDate(event.at)}
            {event.reason ? `: ${event.reason}` : ""}
          </p>
        ))}
    </div>
  );
}

/**
 * An order's refunds in the admin console, with recording a refund made by
 * hand (evidence required) and reopening a wrong completion.
 */
export default function AdminOrderRefunds({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const { handleSuccessToast, handleErrorToast } = useToastAlert();
  const [completing, setCompleting] = useState<OrderRefund | null>(null);
  const [evidence, setEvidence] = useState(emptyEvidence);
  const [reopening, setReopening] = useState<OrderRefund | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [QueryKeys.ADMIN_ORDERS] });

  const completeMutation = useMutation({
    mutationFn: (refund: OrderRefund) =>
      completeAdminOrderRefund(order._id, refund._id, {
        method: evidence.method,
        reference: evidence.reference.trim(),
        amount: Number(evidence.amount),
        note: evidence.note.trim() || undefined,
      }),
    onSuccess: () => {
      handleSuccessToast({
        description: "Refund recorded. The shopper has been emailed the reference.",
      });
      setCompleting(null);
      void refresh();
    },
    onError: (err: Error) => handleErrorToast({ description: err.message }),
  });

  const reopenMutation = useMutation({
    mutationFn: (refund: OrderRefund) =>
      reopenAdminOrderRefund(order._id, refund._id, {
        reason: reopenReason.trim(),
      }),
    onSuccess: () => {
      handleSuccessToast({ description: "Refund is back in the queue." });
      setReopening(null);
      void refresh();
    },
    onError: (err: Error) => handleErrorToast({ description: err.message }),
  });

  if (!order.refunds?.length) return null;

  const amountEntered = Number(evidence.amount);
  const amountMatches =
    !!completing &&
    evidence.amount.trim() !== "" &&
    Math.round(amountEntered * 100) === Math.round(completing.amount * 100);
  const canSubmitCompletion =
    amountMatches && evidence.reference.trim().length >= 4;

  return (
    <>
      <ul className="mt-2 space-y-2">
        {order.refunds.map((refund) => (
          <li key={refund._id} className="text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <RefundFlags refund={refund} />
              <span className="text-[#484848]">
                {formatNaira(refund.amount)} · {getRefundReasonLabel(refund.reason)}
                {refund.escrowId
                  ? ` · escrow ${refund.escrowId}`
                  : refund.paymentReference
                    ? ` · ${refund.paymentReference}`
                    : ""}
              </span>
              {refund.status === "REFUNDED" && refund.payout ? (
                <span className="text-[#484848]">
                  · {getRefundPayoutMethodLabel(refund.payout.method)}{" "}
                  {refund.payout.reference} on {formatOrderDate(refund.refundedAt)}
                </span>
              ) : null}
              {refund.status === "REQUIRED" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    setEvidence(emptyEvidence);
                    setCompleting(refund);
                  }}
                >
                  Record refund
                </Button>
              ) : null}
              {refund.status === "REFUNDED" &&
              refund.resolvedBy === "ADMIN" &&
              !refund.providerConfirmedAt ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    setReopenReason("");
                    setReopening(refund);
                  }}
                >
                  Reopen
                </Button>
              ) : null}
            </div>
            <PreviousPayouts refund={refund} />
          </li>
        ))}
      </ul>

      <Dialog
        open={completing !== null}
        onOpenChange={(open) => {
          if (!open) setCompleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a refund you have made</DialogTitle>
            <DialogDescription>
              {completing
                ? `Only record this once ${formatNaira(completing.amount)} has actually been sent to the shopper for order ${orderLabel(order)}. They will be emailed the reference and can report it if it doesn't arrive.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <label className="mt-3 block text-sm text-[#484848]">
            How was it paid?
            <select
              value={evidence.method}
              onChange={(e) =>
                setEvidence((prev) => ({
                  ...prev,
                  method: e.target.value as OrderRefundPayoutMethod,
                }))
              }
              className="mt-2 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-[#030803]"
            >
              {PAYOUT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {getRefundPayoutMethodLabel(method)}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Payout reference (from the bank or Kashia)"
            placeholder="e.g. FT26315XYZ"
            value={evidence.reference}
            maxLength={100}
            onChange={(e) =>
              setEvidence((prev) => ({ ...prev, reference: e.target.value }))
            }
          />
          <Input
            label="Amount sent (type it to confirm)"
            inputMode="decimal"
            placeholder="0.00"
            value={evidence.amount}
            onChange={(e) =>
              setEvidence((prev) => ({ ...prev, amount: e.target.value }))
            }
          />
          {evidence.amount.trim() !== "" && !amountMatches ? (
            <p className="text-xs text-red-600">
              This doesn&apos;t match the refund amount. Check you are recording
              the right refund.
            </p>
          ) : null}
          <Input
            label="Note for the shopper (optional)"
            placeholder="e.g. Sent to the account you paid from"
            value={evidence.note}
            maxLength={500}
            onChange={(e) =>
              setEvidence((prev) => ({ ...prev, note: e.target.value }))
            }
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleting(null)}>
              Cancel
            </Button>
            <Button
              disabled={!canSubmitCompletion || completeMutation.isPending}
              onClick={() => completing && completeMutation.mutate(completing)}
            >
              Record refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reopening !== null}
        onOpenChange={(open) => {
          if (!open) setReopening(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen this refund?</DialogTitle>
            <DialogDescription>
              It goes back into the refund queue. The recorded payout
              {reopening?.payout ? ` (${reopening.payout.reference})` : ""} stays
              in its history.
            </DialogDescription>
          </DialogHeader>
          <Input
            label="Why?"
            placeholder="e.g. Marked by mistake — that transfer was for another order"
            value={reopenReason}
            maxLength={500}
            onChange={(e) => setReopenReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopening(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                reopenReason.trim().length < 5 || reopenMutation.isPending
              }
              onClick={() => reopening && reopenMutation.mutate(reopening)}
            >
              Reopen refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
