import {
  BarChart3,
  Heart,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MetricBar = {
  label: string;
  value: number;
  max: number;
};

type DashboardMetricsBentoProps = {
  revenue: {
    value: string;
    change?: string | null;
    positive?: boolean;
    bars: MetricBar[];
  };
  balance: string;
  profits: {
    value: string;
    change?: string | null;
    positive?: boolean;
  };
  favourites: string;
  bookmarks: string;
};

function MiniStat({
  label,
  value,
  change,
  positive = true,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  change?: string | null;
  positive?: boolean;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50">
          <Icon className="h-4 w-4 text-[#030803]" aria-hidden />
        </div>
        {change ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              positive ? "bg-traffik-green/10 text-traffik-green" : "bg-red-50 text-red-600",
            )}
          >
            {change}
          </span>
        ) : null}
      </div>
      <div className="mt-4">
        <p className="text-xl font-bold tracking-tight text-[#030803]">{value}</p>
        <p className="mt-0.5 text-xs text-[#484848]">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardMetricsBento({
  revenue,
  balance,
  profits,
  favourites,
  bookmarks,
}: DashboardMetricsBentoProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-2">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-traffik-amber/10 blur-2xl" />
        <div className="relative flex h-full flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-traffik-amber/15">
                <TrendingUp className="h-4 w-4 text-[#030803]" />
              </div>
              {revenue.change ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    revenue.positive !== false
                      ? "bg-traffik-green/10 text-traffik-green"
                      : "bg-red-50 text-red-600",
                  )}
                >
                  {revenue.change} vs last week
                </span>
              ) : null}
            </div>
            <p className="text-3xl font-bold tracking-tight text-[#030803]">
              {revenue.value}
            </p>
            <p className="mt-1 text-sm text-[#484848]">Revenue · last 7 days</p>
          </div>

          <div className="flex h-24 items-end gap-1.5 sm:min-w-[180px]">
            {revenue.bars.map((bar) => {
              const height = bar.max > 0 ? Math.max(12, (bar.value / bar.max) * 100) : 12;
              return (
                <div key={bar.label} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-traffik-amber to-traffik-pink/80 transition-all"
                    style={{ height: `${height}%` }}
                    title={`${bar.label}: ${bar.value}`}
                  />
                  <span className="text-[9px] font-medium uppercase text-[#484848]">
                    {bar.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <MiniStat label="Available balance" value={balance} icon={Wallet} />

      <MiniStat
        label="Profits · 30 days"
        value={profits.value}
        change={profits.change ?? undefined}
        positive={profits.positive}
        icon={BarChart3}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:col-span-2 xl:col-span-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-traffik-pink/10">
              <Heart className="h-4 w-4 text-traffik-pink" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#030803]">{favourites}</p>
              <p className="text-xs text-[#484848]">Product favourites</p>
            </div>
          </div>
          <div className="h-10 w-px bg-gray-100" />
          <div className="text-right">
            <p className="text-xl font-bold text-[#030803]">{bookmarks}</p>
            <p className="text-xs text-[#484848]">Store saves this month</p>
          </div>
        </div>
      </div>
    </div>
  );
}
