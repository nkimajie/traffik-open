"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type PendingApprovalNoticeProps = {
  email?: string;
  compact?: boolean;
};

export default function PendingApprovalNotice({
  email,
  compact = false,
}: PendingApprovalNoticeProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-traffik-amber/25 bg-gradient-to-r from-traffik-amber/8 via-white to-traffik-pink/5 ${
        compact ? "p-4" : "p-6 sm:p-8"
      }`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-traffik-amber/10 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-traffik-amber/15">
          <ShieldCheck className="h-5 w-5 text-traffik-amber" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="font-semibold text-[#030803]">
              Store verification in progress
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#484848]">
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
            </p>
          </div>
          {!compact && (
            <Button asChild className="rounded-xl bg-traffik-pink hover:bg-traffik-pink/90">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
