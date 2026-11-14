import { cn } from "@/lib/utils";
import {
  hasStructuredBusinessHours,
  isStoreOpen,
} from "@/lib/utils/business-hours";

type StoreStatusPillProps = {
  businessHours: unknown;
  className?: string;
};

export default function StoreStatusPill({
  businessHours,
  className,
}: StoreStatusPillProps) {
  if (!hasStructuredBusinessHours(businessHours)) {
    return null;
  }

  const open = isStoreOpen(businessHours);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        open
          ? "bg-traffik-green/15 text-traffik-green"
          : "bg-gray-900/60 text-white",
        className,
      )}
      aria-label={open ? "Store is open" : "Store is closed"}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          open ? "bg-traffik-green" : "bg-gray-300",
        )}
        aria-hidden
      />
      {open ? "Open" : "Closed"}
    </span>
  );
}
