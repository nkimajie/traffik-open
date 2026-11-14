import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export default function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-[#484848]">
        <li>
          <Link
            href="/"
            className="inline-flex items-center gap-1 transition-colors hover:text-traffik-pink"
          >
            <Home className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only sm:not-sr-only">Home</span>
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" aria-hidden />
            {item.href ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-traffik-pink"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-[#030803]" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
