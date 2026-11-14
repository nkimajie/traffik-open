"use client";

import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoreVerificationStatus } from "@/lib/constants/vendor-onboarding";

type StoreVerificationNoticeProps = {
  status: StoreVerificationStatus;
  email?: string;
  storeName?: string;
  compact?: boolean;
};

export default function StoreVerificationNotice({
  status,
  email,
  storeName,
  compact = false,
}: StoreVerificationNoticeProps) {
  if (status === "incomplete") {
    return null;
  }

  const isApproved = status === "approved";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${
        isApproved
          ? "border-emerald-200 bg-gradient-to-r from-emerald-50/80 via-white to-traffik-green/5"
          : "border-traffik-amber/25 bg-gradient-to-r from-traffik-amber/8 via-white to-traffik-pink/5"
      } ${compact ? "p-4" : "p-6 sm:p-8"}`}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl ${
          isApproved ? "bg-emerald-100/60" : "bg-traffik-amber/10"
        }`}
      />
      <div className="relative flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isApproved ? "bg-emerald-100" : "bg-traffik-amber/15"
          }`}
        >
          {isApproved ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-traffik-amber" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="font-semibold text-[#030803]">
              {isApproved ? "Store verified" : "Store verification in progress"}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#484848]">
              {isApproved ? (
                <>
                  {storeName ? (
                    <>
                      <span className="font-medium text-[#030803]">{storeName}</span>{" "}
                      is approved on Traffik. You can list products and start selling.
                    </>
                  ) : (
                    "Your store is approved on Traffik. You can list products and start selling."
                  )}
                </>
              ) : (
                <>
                  A Traffik live agent will contact you
                  {email ? (
                    <>
                      {" "}
                      at{" "}
                      <span className="font-medium text-[#030803]">{email}</span>
                    </>
                  ) : null}{" "}
                  to verify your store. Product listing unlocks once you&apos;re
                  approved — everything else on your dashboard is ready now.
                </>
              )}
            </p>
          </div>
          {!compact && (
            <Button
              asChild
              className={
                isApproved
                  ? "rounded-xl bg-traffik-green hover:bg-traffik-green/90"
                  : "rounded-xl bg-traffik-pink hover:bg-traffik-pink/90"
              }
            >
              <Link href={isApproved ? "/dashboard/products/new" : "/dashboard"}>
                {isApproved ? "Add your first product" : "Go to dashboard"}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
