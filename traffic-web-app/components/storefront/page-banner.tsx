import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Breadcrumbs, { type BreadcrumbItem } from "@/components/storefront/breadcrumbs";

type PageBannerProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  children?: React.ReactNode;
  variant?: "default" | "gradient";
};

export default function PageBanner({
  eyebrow,
  title,
  description,
  breadcrumbs,
  children,
  variant = "default",
}: PageBannerProps) {
  return (
    <section
      className={
        variant === "gradient"
          ? "relative overflow-hidden border-b border-gray-100 bg-[#fafafa]"
          : "border-b border-gray-100 bg-white"
      }
    >
      {variant === "gradient" && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,83,144,0.06)_0%,_transparent_50%),radial-gradient(ellipse_at_bottom_left,_rgba(104,175,107,0.06)_0%,_transparent_50%)]" />
      )}
      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs items={breadcrumbs} className="mb-4" />
        )}
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-traffik-pink">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#030803] sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#484848]">
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

export function PageBannerLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-traffik-pink transition-colors hover:text-traffik-pink/80"
    >
      {children}
      <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}
