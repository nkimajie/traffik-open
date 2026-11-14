import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardStatCardProps = {
  label: string;
  value: string;
  change?: string | null;
  icon: LucideIcon;
  positive?: boolean;
  accent?: "pink" | "amber" | "green" | "neutral";
  className?: string;
};

const accentStyles = {
  pink: {
    icon: "bg-traffik-pink/10 text-traffik-pink",
    ring: "ring-traffik-pink/10",
  },
  amber: {
    icon: "bg-traffik-amber/15 text-[#030803]",
    ring: "ring-traffik-amber/15",
  },
  green: {
    icon: "bg-traffik-green/15 text-traffik-green",
    ring: "ring-traffik-green/15",
  },
  neutral: {
    icon: "bg-gray-100 text-[#030803]",
    ring: "ring-gray-100",
  },
} as const;

export default function DashboardStatCard({
  label,
  value,
  change,
  icon: Icon,
  positive = true,
  accent = "neutral",
  className,
}: DashboardStatCardProps) {
  const styles = accentStyles[accent];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ring-1 transition-shadow hover:shadow-md",
        styles.ring,
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-traffik-pink/5 via-traffik-amber/5 to-traffik-green/5 opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              styles.icon,
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          {change ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                positive
                  ? "bg-traffik-green/10 text-traffik-green"
                  : "bg-red-50 text-red-600",
              )}
            >
              {change}
            </span>
          ) : null}
        </div>
        <p className="text-2xl font-bold tracking-tight text-[#030803]">{value}</p>
        <p className="mt-1 text-sm text-[#484848]">{label}</p>
      </div>
    </div>
  );
}
