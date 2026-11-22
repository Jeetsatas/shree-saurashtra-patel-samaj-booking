/**
 * Utility functions for booking slots and flexible timings management.
 * Supports:
 *  - Whole Day / Full Day bookings (06:00 AM - 11:59 PM)
 *  - Half Day Morning (06:00 AM - 02:00 PM)
 *  - Half Day Evening/Afternoon (03:00 PM - 11:59 PM)
 *  - Room Night Stay (24 Hours) & Day Rest (08:00 AM - 06:00 PM)
 *  - Custom Time Ranges (e.g. "12:00 PM - 02:00 PM", "03:00 PM - 04:00 PM", "12 to 2 pm", "3 to 4 pm")
 */

export interface TimeRange {
  start: number; // minutes from midnight (0 to 1440)
  end: number;   // minutes from midnight
  label: string;
}

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
  { label: "08:00 AM - 12:00 PM (4 કલાક)", from: "08:00 AM", to: "12:00 PM" },
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

export function parseSlotTimeRange(slot: string | null | undefined): TimeRange {
  if (!slot) return { start: 0, end: 1440, label: "Whole Day" };
  const s = slot.toUpperCase().trim();

  // 1. Whole day / 24 hour indicators
  if (
    s.includes("WHOLE_DAY") ||
    s.includes("FULL_DAY") ||
    s.includes("WHOLE DAY") ||
    s.includes("FULL EVENT") ||
    s.includes("આખો દિવસ") ||
    s.includes("NIGHT_STAY") ||
    s.includes("24 HOURS")
  ) {
    return { start: 0, end: 1440, label: "Whole Day (આખો દિવસ)" };
  }

  // 2. Morning half-day indicators (06:00 AM to 02:00 PM)
  if (
    s.includes("HALF_DAY_MORNING") ||
    (s.includes("MORNING") &&
      !s.includes("EVENING") &&
      !s.includes("AFTERNOON") &&
      !s.includes("-") &&
      !s.includes("TO"))
  ) {
    return { start: 360, end: 840, label: "Morning (06:00 AM - 02:00 PM)" };
  }

  // 3. Evening / Afternoon half-day indicators (03:00 PM to 11:59 PM)
  if (
    (s.includes("HALF_DAY_EVENING") ||
      s.includes("HALF_DAY_AFTERNOON") ||
      s.includes("AFTERNOON") ||
      s.includes("EVENING")) &&
    !s.includes("-") &&
    !s.includes("TO")
  ) {
    return { start: 900, end: 1440, label: "Evening (03:00 PM - 11:00 PM)" };
  }

  // 4. Day Rest for rooms/dorms (08:00 AM to 06:00 PM)
  if (s.includes("DAY_REST")) {
    return { start: 480, end: 1080, label: "Day Rest (08:00 AM - 06:00 PM)" };
  }

  // 5. Explicit time range pattern like "12:00 PM - 02:00 PM" or "12 to 2 pm" or "12 PM - 2 PM"
  const rangeMatch = slot.match(
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
        finalEnd += 1440; // spans midnight
      }
      return { start: startMin, end: finalEnd, label: `${startPart} - ${endPart}` };
    }
  }

  // Fallback: treat as whole day if unrecognized
  return { start: 0, end: 1440, label: slot };
}

/**
 * Determines whether two booking slots on the same day overlap.
 * Uses strict interval intersection: max(start1, start2) < min(end1, end2).
 * Contiguous boundaries (e.g. 12-2 PM and 2-4 PM) do NOT conflict.
 */
export function doSlotsOverlap(
  slotA: string | null | undefined,
  slotB: string | null | undefined
): boolean {
  const rA = parseSlotTimeRange(slotA);
  const rB = parseSlotTimeRange(slotB);
  return Math.max(rA.start, rB.start) < Math.min(rA.end, rB.end);
}

/**
 * Check whether a slot represents a full day booking.
 */
export function isFullDaySlot(slot: string | null | undefined): boolean {
  const range = parseSlotTimeRange(slot);
  return range.start <= 360 && range.end >= 1439;
}

/**
 * Returns a human-friendly display label for any slot or timing string.
 */
export function formatSlotLabel(slot: string | null | undefined): string {
  if (!slot) return "Whole Day (આખો દિવસ)";
  const s = slot.trim();
  if (s === "WHOLE_DAY" || s === "FULL_DAY") return "Whole Day / Full Event (06:00 AM - 11:00 PM)";
  if (s === "HALF_DAY_MORNING" || s === "MORNING" || s === "MORNING_SLOT") return "Half Day - Morning (06:00 AM - 02:00 PM)";
  if (s === "HALF_DAY_EVENING" || s === "AFTERNOON" || s === "AFTERNOON_SLOT" || s === "EVENING") return "Half Day - Evening (03:00 PM - 11:00 PM)";
  if (s === "NIGHT_STAY") return "Night Stay (24 Hours)";
  if (s === "DAY_REST") return "Day Rest (08:00 AM - 06:00 PM)";
  return s;
}
