"use client";

import Link from "next/link";
import { Check, Circle, Package, ShieldCheck, Store } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardGettingStartedProps = {
  signupComplete: boolean;
  isApproved: boolean;
  canCreateProducts: boolean;
  hasProducts: boolean;
};

type Step = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  href?: string;
  actionLabel?: string;
};

export default function DashboardGettingStarted({
  signupComplete,
  isApproved,
  canCreateProducts,
  hasProducts,
}: DashboardGettingStartedProps) {
  const steps: Step[] = [
    {
      id: "profile",
      label: "Business profile",
      description: "Store name, contact & hours",
      done: signupComplete,
      href: "/dashboard/settings",
      actionLabel: "Review",
    },
    {
      id: "verify",
      label: "Store verification",
      description: "Traffik agent confirms your store",
      done: isApproved,
      href: "/create-business/step2",
      actionLabel: "Status",
    },
    {
      id: "product",
      label: "First product",
      description: "List an item to start selling",
      done: hasProducts,
      href: canCreateProducts ? "/dashboard/products/new" : undefined,
      actionLabel: canCreateProducts ? "Add product" : undefined,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  if (completedCount === steps.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#030803]">Getting started</h2>
          <p className="mt-0.5 text-xs text-[#484848]">
            {completedCount} of {steps.length} complete
          </p>
        </div>
        <span className="text-sm font-bold text-traffik-pink">{progress}%</span>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-traffik-pink via-traffik-amber to-traffik-green transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="space-y-3">
        {steps.map((step) => (
          <li
            key={step.id}
            className={cn(
              "flex items-start gap-3 rounded-xl p-3 transition-colors",
              step.done ? "bg-traffik-green/5" : "bg-gray-50/80",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                step.done
                  ? "bg-traffik-green text-white"
                  : "border-2 border-gray-200 bg-white text-transparent",
              )}
            >
              {step.done ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : (
                <Circle className="h-3 w-3 text-gray-300" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#030803]">{step.label}</p>
              <p className="text-xs text-[#484848]">{step.description}</p>
            </div>
            {!step.done && step.href && step.actionLabel ? (
              <Link
                href={step.href}
                className="shrink-0 text-xs font-semibold text-traffik-pink hover:underline"
              >
                {step.actionLabel}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      {!isApproved && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-traffik-amber/8 p-3 text-xs text-[#484848]">
          <Store className="mt-0.5 h-4 w-4 shrink-0 text-traffik-amber" />
          <span>
            Explore orders, customers, and settings while you wait.{" "}
            <ShieldCheck className="inline h-3.5 w-3.5 text-traffik-green" />{" "}
            Product listing unlocks after verification.
          </span>
        </div>
      )}

      {canCreateProducts && !steps[2].done && (
        <Link
          href="/dashboard/products/new"
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#030803] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Package className="h-4 w-4" />
          Add your first product
        </Link>
      )}
    </section>
  );
}
