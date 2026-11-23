/**
 * Utility functions for booking slots and flexible timings management.
 * Supported 2 primary timing modes:
 *  1. Whole Day / 24 Hours:
 *     - Check-in: 09:00 AM (Booking day)
 *     - Check-out: 08:00 AM (Next day morning)
 *     - Example: 24 Nov Whole Day is booked from 09:00 AM 24 Nov to 08:00 AM 25 Nov.
 *  2. Custom Timings:
 *     - Specific hourly slot (e.g. 12:00 PM - 02:00 PM, 03:00 PM - 04:00 PM)
 */

export interface TimeRange {
  start: number; // minutes from midnight of day 1 (09:00 AM = 540)
  end: number;   // minutes (next day 08:00 AM = 1440 + 480 = 1920)
  label: string;
}

export const WHOLE_DAY_SLOT_LABEL = "Whole Day (09:00 AM - 08:00 AM Next Day)";
export const WHOLE_DAY_SLOT_GUJARATI = "Whole Day / 24 Hours (આખો દિવસ: 09:00 AM થી બીજા દિવસે 08:00 AM ચેકઆઉટ)";

export const STANDARD_HOURS = [
  "06:00 AM", "06:30 AM", "07:00 AM", "07:30 AM",
  "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM",
  "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM",
  "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
  "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM",
  "08:00 PM", "08:30 PM", "09:00 PM", "09:30 PM",
  "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM"
];

export const TIMING_PRESETS = [
  { label: "12:00 PM - 02:00 PM (2 કલાક)", from: "12:00 PM", to: "02:00 PM" },
  { label: "03:00 PM - 04:00 PM (1 કલાક)", from: "03:00 PM", to: "04:00 PM" },
  { label: "04:00 PM - 07:00 PM (3 કલાક)", from: "04:00 PM", to: "07:00 PM" },
  { label: "07:00 PM - 10:00 PM (3 કલાક)", from: "07:00 PM", to: "10:00 PM" },
  { label: "09:00 AM - 01:00 PM (4 કલાક)", from: "09:00 AM", to: "01:00 PM" },
];

export function parseTimeToMinutes(str: string, defaultMeridiem: "AM" | "PM" = "AM"): number | null {
  if (!str) return null;
  const match = str.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = match[2] ? parseInt(match[2], 10) : 0;
  let meridiem = match[3] ? (match[3].toUpperCase() as "AM" | "PM") : defaultMeridiem;

  if (meridiem === "PM" && h < 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

/**
 * Check whether a slot string represents a full day booking.
 */
export function isFullDaySlot(slot: string | null | undefined): boolean {
  if (!slot) return true;
  const s = slot.toUpperCase().trim();
  return (
    s.includes("WHOLE") ||
    s.includes("FULL") ||
    s.includes("આખો દિવસ") ||
    s.includes("24 HOUR") ||
    s.includes("NIGHT_STAY") ||
    s.includes("NEXT DAY")
  );
}

/**
 * Parses date string or Date object into year, month (0-indexed), and day safely.
 * Avoids any timezone shift bugs across servers and clients.
 */
export function parseDateComponents(dateInput: string | Date): { y: number; m: number; d: number } {
  if (dateInput instanceof Date) {
    return {
      y: dateInput.getFullYear(),
      m: dateInput.getMonth(),
      d: dateInput.getDate(),
    };
  }
  const str = String(dateInput).split("T")[0];
  const parts = str.split("-");
  if (parts.length >= 3) {
    return {
      y: parseInt(parts[0], 10),
      m: parseInt(parts[1], 10) - 1,
      d: parseInt(parts[2], 10),
    };
  }
  const d = new Date(dateInput);
  return {
    y: d.getFullYear(),
    m: d.getMonth(),
    d: d.getDate(),
  };
}

/**
 * Returns exact start Date and end Date for any booking.
 * - Whole Day: Check-in 09:00 AM on booking day, check-out 08:00 AM on next day morning.
 * - Custom Timing: Exact start and end timestamps on the date.
 */
export function getBookingExactTimeRange(
  dateInput: string | Date,
  slot: string | null | undefined
): { start: Date; end: Date } {
  const { y, m, d } = parseDateComponents(dateInput);

  if (isFullDaySlot(slot)) {
    // 09:00 AM on booking day -> 08:00 AM next day
    const start = new Date(y, m, d, 9, 0, 0, 0);
    const end = new Date(y, m, d + 1, 8, 0, 0, 0);
    return { start, end };
  }

  // Custom timing, e.g. "12:00 PM - 02:00 PM"
  const rangeMatch = String(slot || "").match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );

  if (rangeMatch) {
    const startPart = rangeMatch[1].trim();
    const endPart = rangeMatch[2].trim();
    const endHasPm = /pm/i.test(endPart);
    const startHasMeridiem = /am|pm/i.test(startPart);

    let defaultStartMeridiem: "AM" | "PM" = "AM";
    if (!startHasMeridiem && endHasPm) {
      const h = parseInt(startPart, 10);
      defaultStartMeridiem = h === 12 || h < 7 ? "PM" : "AM";
    }

    const startMin = parseTimeToMinutes(startPart, defaultStartMeridiem);
    const endMin = parseTimeToMinutes(endPart, endHasPm ? "PM" : "AM");

    if (startMin !== null && endMin !== null) {
      const start = new Date(y, m, d, Math.floor(startMin / 60), startMin % 60, 0, 0);
      let endDay = d;
      if (endMin <= startMin) endDay += 1;
      const end = new Date(y, m, endDay, Math.floor(endMin / 60), endMin % 60, 0, 0);
      return { start, end };
    }
  }

  // Fallback: Whole Day 09:00 AM to next day 08:00 AM
  return {
    start: new Date(y, m, d, 9, 0, 0, 0),
    end: new Date(y, m, d + 1, 8, 0, 0, 0),
  };
}

/**
 * Universal conflict checker for bookings.
 * Two bookings conflict if and only if their exact date-time ranges overlap:
 *   rangeA.start < rangeB.end AND rangeB.start < rangeA.end.
 *
 * Example:
 *  Booking 1: 24 Nov Whole Day (24 Nov 09:00 AM - 25 Nov 08:00 AM)
 *  Booking 2: 25 Nov Whole Day (25 Nov 09:00 AM - 26 Nov 08:00 AM)
 *  Result: NO CONFLICT! Consecutive whole-day bookings seamlessly chain with 1-hr turnover buffer.
 */
export function doBookingsConflict(
  a: { startDate: string | Date; slot: string | null | undefined },
  b: { startDate: string | Date; slot: string | null | undefined }
): boolean {
  if (!a || !b) return false;
  const rangeA = getBookingExactTimeRange(a.startDate, a.slot);
  const rangeB = getBookingExactTimeRange(b.startDate, b.slot);
  return rangeA.start.getTime() < rangeB.end.getTime() && rangeB.start.getTime() < rangeA.end.getTime();
}

/**
 * Same-day / legacy slot overlap checker.
 */
export function parseSlotTimeRange(slot: string | null | undefined): TimeRange {
  if (isFullDaySlot(slot)) {
    // 09:00 AM (540m) to next day 08:00 AM (1440 + 480 = 1920m)
    return { start: 540, end: 1920, label: WHOLE_DAY_SLOT_LABEL };
  }

  const rangeMatch = String(slot || "").match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );
  if (rangeMatch) {
    const startPart = rangeMatch[1].trim();
    const endPart = rangeMatch[2].trim();
    const endHasPm = /pm/i.test(endPart);
    const startHasMeridiem = /am|pm/i.test(startPart);

    let defaultStartMeridiem: "AM" | "PM" = "AM";
    if (!startHasMeridiem && endHasPm) {
      const h = parseInt(startPart, 10);
      defaultStartMeridiem = h === 12 || h < 7 ? "PM" : "AM";
    }

    const startMin = parseTimeToMinutes(startPart, defaultStartMeridiem);
    const endMin = parseTimeToMinutes(endPart, endHasPm ? "PM" : "AM");

    if (startMin !== null && endMin !== null) {
      let finalEnd = endMin;
      if (finalEnd <= startMin) {
        finalEnd += 1440;
      }
      return { start: startMin, end: finalEnd, label: `${startPart} - ${endPart}` };
    }
  }

  return { start: 540, end: 1920, label: slot || WHOLE_DAY_SLOT_LABEL };
}

export function doSlotsOverlap(
  slotA: string | null | undefined,
  slotB: string | null | undefined
): boolean {
  if (isFullDaySlot(slotA) || isFullDaySlot(slotB)) {
    return true;
  }
  const rA = parseSlotTimeRange(slotA);
  const rB = parseSlotTimeRange(slotB);
  return Math.max(rA.start, rB.start) < Math.min(rA.end, rB.end);
}

/**
 * Returns clean human-readable slot display label.
 */
export function formatSlotLabel(slot: string | null | undefined): string {
  if (!slot || isFullDaySlot(slot)) {
    return WHOLE_DAY_SLOT_LABEL;
  }
  return slot.trim();
}

export type SlotPeriodKey = "MORNING" | "AFTERNOON" | "NIGHT";

export interface SlotPeriodInfo {
  periodKey: SlotPeriodKey;
  order: number; // 1: Morning, 2: Noon/Afternoon, 3: Night/Late Night
  periodLabelGu: string; // "🌅 સવાર (Morning)" / "☀️ બપોર (Afternoon)" / "🌙 સાંજ-રાત્રિ (Night)"
  periodName: string; // "સવાર" / "બપોર" / "સાંજ / રાત્રિ"
  badgeClass: string;
  dotColor: string;
  startMinutes: number;
  isWholeDay: boolean;
}

/**
 * Returns the start time of any slot in minutes from 00:00.
 * Whole Day check-in is 09:00 AM (540m).
 * Midnight to 05:00 AM is sorted as late night (1440+m).
 */
export function getSlotStartMinutes(slot: string | null | undefined): number {
  if (!slot || isFullDaySlot(slot)) {
    return 540; // 09:00 AM (Whole Day check-in is Morning 09:00 AM)
  }

  const s = String(slot).trim();
  const rangeMatch = s.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );

  if (rangeMatch) {
    const startPart = rangeMatch[1].trim();
    const endPart = rangeMatch[2].trim();
    const endHasPm = /pm/i.test(endPart);
    const startHasMeridiem = /am|pm/i.test(startPart);

    let defaultStartMeridiem: "AM" | "PM" = "AM";
    if (!startHasMeridiem && endHasPm) {
      const h = parseInt(startPart, 10);
      defaultStartMeridiem = h === 12 || h < 7 ? "PM" : "AM";
    }

    const startMin = parseTimeToMinutes(startPart, defaultStartMeridiem);
    if (startMin !== null) {
      // Midnight to 04:59 AM is late night, sort after evening (1440+)
      if (startMin < 300) {
        return 1440 + startMin;
      }
      return startMin;
    }
  }

  const upper = s.toUpperCase();
  if (upper.includes("DAY_TIME") || upper.includes("MORNING")) return 360; // 06:00 AM
  if (upper.includes("AFTERNOON") || upper.includes("NOON")) return 720; // 12:00 PM
  if (upper.includes("NIGHT_TIME") || upper.includes("EVENING")) return 1080; // 06:00 PM
  if (upper.includes("NIGHT_HOLD") || upper.includes("DAY_REST")) return 1260; // 09:00 PM

  return 540;
}

export function getSlotPeriodInfo(slot: string | null | undefined): SlotPeriodInfo {
  const isWhole = isFullDaySlot(slot);
  if (isWhole) {
    return {
      periodKey: "MORNING",
      order: 1,
      periodLabelGu: "🌅 સવાર / આખો દિવસ (Morning / Whole Day)",
      periodName: "સવાર / આખો દિવસ",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      dotColor: "#d97706",
      startMinutes: 540,
      isWholeDay: true,
    };
  }

  const min = getSlotStartMinutes(slot);
  // Morning: 05:00 AM to 11:59 AM (300 to 719 min)
  if (min >= 300 && min < 720) {
    return {
      periodKey: "MORNING",
      order: 1,
      periodLabelGu: "🌅 સવાર (Morning Slot)",
      periodName: "સવાર",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      dotColor: "#d97706",
      startMinutes: min,
      isWholeDay: false,
    };
  }

  // Noon & Afternoon: 12:00 PM to 04:59 PM (720 to 1019 min)
  if (min >= 720 && min < 1020) {
    return {
      periodKey: "AFTERNOON",
      order: 2,
      periodLabelGu: "☀️ બપોર (Noon/Afternoon)",
      periodName: "બપોર",
      badgeClass: "bg-sky-100 text-sky-900 border-sky-300",
      dotColor: "#0284c7",
      startMinutes: min,
      isWholeDay: false,
    };
  }

  // Night & Late Night: 05:00 PM onwards (>= 1020 min)
  return {
    periodKey: "NIGHT",
    order: 3,
    periodLabelGu: "🌙 સાંજ / રાત્રિ (Night Slot)",
    periodName: "સાંજ / રાત્રિ",
    badgeClass: "bg-indigo-100 text-indigo-900 border-indigo-300",
    dotColor: "#6366f1",
    startMinutes: min,
    isWholeDay: false,
  };
}

/**
 * Sorts bookings chronologically from morning to night.
 */
export function sortBookingsFromMorningToNight(bookings: any[]): any[] {
  if (!bookings || bookings.length <= 1) return bookings || [];
  return [...bookings].sort((a, b) => getSlotStartMinutes(a.slot) - getSlotStartMinutes(b.slot));
}
