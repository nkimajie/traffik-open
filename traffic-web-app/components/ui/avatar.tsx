import * as React from "react";
import { cn } from "@/lib/utils";

type AvatarProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

function Avatar({ className, size = "md", children, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-traffik-pink/20 to-traffik-green/20 font-semibold text-[#030803]",
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function AvatarFallback({
  className,
  children,
}: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("font-semibold", className)}>{children}</span>;
}

export { Avatar, AvatarFallback };
