"use client";

import * as React from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type MultiSelectOption = {
  value: string;
  label: string;
};

type MultiSelectProps = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxSelected?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-invalid"?: boolean;
};

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select options",
  maxSelected = 5,
  disabled,
  className,
  id,
  "aria-invalid": ariaInvalid,
}: MultiSelectProps) {
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

  const selectedOptions = options.filter((option) =>
    value.includes(option.value),
  );

  function toggleOption(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
      return;
    }
    if (value.length >= maxSelected) return;
    onChange([...value, optionValue]);
  }

  function removeOption(optionValue: string) {
    onChange(value.filter((item) => item !== optionValue));
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-invalid={ariaInvalid ? true : undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex min-h-12 w-full items-center justify-between gap-2 rounded-md border border-black bg-white px-3 py-2 text-left text-sm text-black",
          disabled && "cursor-not-allowed opacity-60",
          ariaInvalid && "border-red-500",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selectedOptions.length === 0 ? (
            <span className="text-gray-500">{placeholder}</span>
          ) : (
            selectedOptions.map((option) => (
              <Badge
                key={option.value}
                variant="default"
                className="gap-1 pr-1"
              >
                {option.label}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-gray-200"
                  aria-label={`Remove ${option.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeOption(option.value);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-gray-500 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
        >
          {options.map((option) => {
            const selected = value.includes(option.value);
            const atLimit = !selected && value.length >= maxSelected;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={atLimit}
                  onClick={() => toggleOption(option.value)}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors",
                    selected
                      ? "bg-traffik-pink/10 text-traffik-pink"
                      : "text-[#484848] hover:bg-gray-50",
                    atLimit && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span>{option.label}</span>
                  {selected ? <span aria-hidden>✓</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
