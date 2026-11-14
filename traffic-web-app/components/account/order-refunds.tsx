import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { OrderRefund } from "@/lib/types/api";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/utils/format-price";
import {
  canReportRefundNotReceived,
  formatOrderDate,
  getLatestRefundEvent,
  getRefundPayoutMethodLabel,
  getRefundReasonLabel,
} from "@/lib/utils/order";

type OrderRefundsProps = {
  refunds?: OrderRefund[];
  /** Shown on refunds marked as sent by hand, so the shopper can say the money never came. */
  onReportNotReceived?: (refund: OrderRefund) => void;
  reportingDisabled?: boolean;
};

/** Where each refund owed on an order stands, as the shopper sees it. */
export default function OrderRefunds({
  refunds,
  onReportNotReceived,
  reportingDisabled,
}: OrderRefundsProps) {
  if (!refunds?.length) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="font-semibold text-[#030803]">
        {refunds.length === 1 ? "Refund" : "Refunds"}
      </h3>
      <ul className="mt-4 space-y-3">
        {refunds.map((refund) => {
          const done = refund.status === "REFUNDED";
          const latest = getLatestRefundEvent(refund);
          const reportedMissing =
            !done && latest?.type === "REOPENED" && latest.actor === "SHOPPER";
          return (
            <li
              key={refund._id}
              className={`flex gap-3 rounded-xl p-4 ${
                done ? "bg-traffik-green/10" : "bg-amber-50"
              }`}
            >
              {done ? (
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-traffik-green"
                  aria-hidden
                />
              ) : reportedMissing ? (
                <AlertCircle
                  className="mt-0.5 h-5 w-5 shrink-0 text-traffik-amber"
                  aria-hidden
                />
              ) : (
                <Clock
                  className="mt-0.5 h-5 w-5 shrink-0 text-traffik-amber"
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-[#030803]">
                  {done
                    ? `${formatNaira(refund.amount)} refunded`
                    : reportedMissing
                      ? `We're checking your refund of ${formatNaira(refund.amount)}`
                      : `Refund of ${formatNaira(refund.amount)} in progress`}
                </p>
                <p className="mt-0.5 text-[#484848]">
                  {getRefundReasonLabel(refund.reason)} ·{" "}
                  {done
                    ? `Sent on ${formatOrderDate(refund.refundedAt)}`
                    : reportedMissing
                      ? `You told us on ${formatOrderDate(latest?.at)} that it hadn't arrived`
                      : `Requested on ${formatOrderDate(refund.requestedAt)}`}
                </p>
                {done && refund.payout ? (
                  <p className="mt-1 text-[#484848]">
                    {getRefundPayoutMethodLabel(refund.payout.method)} ·
                    Reference{" "}
                    <span className="font-medium text-[#030803]">
                      {refund.payout.reference}
                    </span>
                  </p>
                ) : null}
                {refund.note ? (
                  <p className="mt-1 text-[#484848]">{refund.note}</p>
                ) : null}
                {onReportNotReceived && canReportRefundNotReceived(refund) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-8 rounded-lg"
                    disabled={reportingDisabled}
                    onClick={() => onReportNotReceived(refund)}
                  >
                    I haven&apos;t received this
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
