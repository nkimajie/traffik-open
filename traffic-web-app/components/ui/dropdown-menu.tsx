"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type DropdownMenuProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
};

function DropdownMenu({
  trigger,
  children,
  align = "end",
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div onClick={() => setOpen((value) => !value)}>{trigger}</div>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "absolute top-full z-20 mt-2 min-w-[200px] rounded-xl border border-gray-200 bg-white py-1 shadow-xl",
              align === "end" ? "right-0" : "left-0",
            )}
            onClick={() => setOpen(false)}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function DropdownMenuItem({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#484848] transition-colors hover:bg-gray-50 hover:text-[#030803]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function DropdownMenuLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={cn(
        "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#484848] transition-colors hover:bg-gray-50 hover:text-[#030803]",
        className,
      )}
    >
      {children}
    </a>
  );
}

function DropdownMenuSeparator() {
  return <div className="my-1 border-t border-gray-100" role="separator" />;
}

export {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLink,
  DropdownMenuSeparator,
};
