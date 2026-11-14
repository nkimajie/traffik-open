import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";

type DashboardPanelProps = {
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  children: ReactNode;
  className?: string;
};

export function DashboardPanel({
  title,
  viewAllHref,
  viewAllLabel = "View all",
  children,
  className = "",
}: DashboardPanelProps) {
  return (
    <section
      className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#030803]">{title}</h2>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="text-xs font-semibold text-traffik-pink hover:underline"
          >
            {viewAllLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

type DashboardEmptyProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function DashboardEmpty({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: DashboardEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
        <Icon className="h-5 w-5 text-[#484848]" aria-hidden />
      </div>
      <p className="font-medium text-[#030803]">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-[#484848]">{description}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 text-sm font-semibold text-traffik-pink hover:underline"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
