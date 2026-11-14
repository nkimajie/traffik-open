import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-gray-100 text-[#484848]",
        pending: "bg-traffik-amber/15 text-[#030803]",
        processing: "bg-blue-50 text-blue-700",
        shipped: "bg-purple-50 text-purple-700",
        delivered: "bg-traffik-green/10 text-traffik-green",
        cancelled: "bg-red-50 text-red-600",
        featured: "bg-traffik-pink/10 text-traffik-pink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
