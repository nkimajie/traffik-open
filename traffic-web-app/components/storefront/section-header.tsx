import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  eyebrow?: string;
  eyebrowColor?: "pink" | "green" | "amber" | "white";
  title: string;
  description?: string;
  action?: { label: string; href: string };
  align?: "left" | "center";
  className?: string;
};

const eyebrowColors = {
  pink: "text-traffik-pink",
  green: "text-traffik-green",
  amber: "text-traffik-amber",
  white: "text-white/80",
};

export default function SectionHeader({
  eyebrow,
  eyebrowColor = "pink",
  title,
  description,
  action,
  align = "left",
  className,
}: SectionHeaderProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        centered && "sm:flex-col sm:items-center sm:text-center",
        className,
      )}
    >
      <div className={cn(centered && "max-w-2xl")}>
        {eyebrow && (
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-widest",
              eyebrowColors[eyebrowColor],
            )}
          >
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#030803] sm:text-3xl lg:text-4xl">
          {title}
        </h2>
        {description && (
          <p
            className={cn(
              "mt-2 text-sm leading-relaxed text-[#484848] sm:text-base",
              centered && "mx-auto",
            )}
          >
            {description}
          </p>
        )}
      </div>

      {action && (
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#030803] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#030803]/90"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
