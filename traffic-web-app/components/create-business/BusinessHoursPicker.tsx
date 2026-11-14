"use client";

import { useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { BusinessHourSlot } from "@/lib/utils/business-hours";
import { normalizeBusinessHours } from "@/lib/utils/business-hours";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

type DayKey = (typeof WEEKDAYS)[number]["key"];

type DaySchedule = {
  open: boolean;
  openTime: string;
  closeTime: string;
};

type WeekSchedule = Record<DayKey, DaySchedule>;

export const DEFAULT_WEEK_SCHEDULE: WeekSchedule = {
  monday: { open: true, openTime: "09:00", closeTime: "18:00" },
  tuesday: { open: true, openTime: "09:00", closeTime: "18:00" },
  wednesday: { open: true, openTime: "09:00", closeTime: "18:00" },
  thursday: { open: true, openTime: "09:00", closeTime: "18:00" },
  friday: { open: true, openTime: "09:00", closeTime: "18:00" },
  saturday: { open: true, openTime: "09:00", closeTime: "18:00" },
  sunday: { open: false, openTime: "09:00", closeTime: "18:00" },
};

export function businessHoursToWeekSchedule(
  slots: BusinessHourSlot[] | undefined,
): WeekSchedule {
  const schedule = structuredClone(DEFAULT_WEEK_SCHEDULE);
  const normalized = normalizeBusinessHours(slots);
  if (!normalized?.length) return schedule;

  for (const day of WEEKDAYS) {
    schedule[day.key] = {
      open: false,
      openTime: "09:00",
      closeTime: "18:00",
    };
  }

  for (const slot of normalized) {
    const dayKey = slot.day?.trim()?.toLowerCase() as DayKey;
    if (!dayKey || !(dayKey in schedule)) continue;
    schedule[dayKey] = {
      open: true,
      openTime: slot.open ?? "09:00",
      closeTime: slot.close ?? "18:00",
    };
  }

  return schedule;
}

export function weekScheduleToBusinessHours(
  schedule: WeekSchedule,
): BusinessHourSlot[] {
  return WEEKDAYS.filter((day) => schedule[day.key].open).map((day) => ({
    day: day.key,
    open: schedule[day.key].openTime,
    close: schedule[day.key].closeTime,
  }));
}

type BusinessHoursPickerProps = {
  value: BusinessHourSlot[];
  onChange: (value: BusinessHourSlot[]) => void;
  className?: string;
};

export default function BusinessHoursPicker({
  value,
  onChange,
  className,
}: BusinessHoursPickerProps) {
  const schedule = useMemo(() => businessHoursToWeekSchedule(value), [value]);

  function updateDay(dayKey: DayKey, patch: Partial<DaySchedule>) {
    const next = {
      ...schedule,
      [dayKey]: { ...schedule[dayKey], ...patch },
    };
    onChange(weekScheduleToBusinessHours(next));
  }

  function applyMondayToAllDays() {
    const monday = schedule.monday;
    const next = { ...schedule };
    for (const day of WEEKDAYS) {
      next[day.key] = {
        open: day.key === "sunday" ? false : monday.open,
        openTime: monday.openTime,
        closeTime: monday.closeTime,
      };
    }
    onChange(weekScheduleToBusinessHours(next));
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-black">Business hours</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={applyMondayToAllDays}
        >
          Apply Monday to all days
        </Button>
      </div>

      <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
        {WEEKDAYS.map((day) => {
          const row = schedule[day.key];
          return (
            <div
              key={day.key}
              className="grid min-w-0 grid-cols-1 items-center gap-3 border-b border-gray-100 py-3 last:border-b-0 sm:grid-cols-[minmax(0,120px)_auto_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <span className="text-sm font-medium text-[#030803]">
                {day.label}
              </span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={row.open}
                  onCheckedChange={(checked) =>
                    updateDay(day.key, { open: checked })
                  }
                  aria-label={`${day.label} open`}
                />
                <span className="text-xs text-[#484848]">
                  {row.open ? "Open" : "Closed"}
                </span>
              </div>
              <label className="flex flex-col gap-1 text-xs text-[#484848]">
                Opens
                <input
                  type="time"
                  value={row.openTime}
                  disabled={!row.open}
                  onChange={(event) =>
                    updateDay(day.key, { openTime: event.target.value })
                  }
                  className="w-full min-w-0 rounded-md border border-gray-200 bg-white px-2 py-2 text-sm text-black disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[#484848]">
                Closes
                <input
                  type="time"
                  value={row.closeTime}
                  disabled={!row.open}
                  onChange={(event) =>
                    updateDay(day.key, { closeTime: event.target.value })
                  }
                  className="w-full min-w-0 rounded-md border border-gray-200 bg-white px-2 py-2 text-sm text-black disabled:opacity-50"
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
