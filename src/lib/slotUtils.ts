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

export type TimePeriodKey = "MORNING" | "AFTERNOON" | "NIGHT";

export interface SlotPeriodDetails {
  periodKey: TimePeriodKey;
  order: number; // 1: Morning, 2: Afternoon, 3: Night
  periodNameGu: string; // "સવાર" | "બપોર" | "સાંજ / રાત્રિ"
  periodTitleGu: string; // "🌅 સવારના સ્લોટ (Morning Timing Slots)"
  periodTitleEn: string; // "Morning Timing Slots"
  periodTimeRange: string; // "06:00 AM – 12:00 PM"
  badgeClass: string;
  dotColor: string;
  startMinutes: number;
  isWholeDay: boolean;
  cleanLabel: string;
}

/**
 * Categorizes a booking slot into one of the 3 canonical day periods:
 *  1. Morning (સવાર): 06:00 AM – 12:00 PM (and Whole Day starting at 09:00 AM)
 *  2. Noon & Afternoon (બપોર): 12:00 PM – 05:00 PM
 *  3. Night & Late Night (સાંજ અને રાત્રિ): 05:00 PM – Late Night (until 05:00 AM)
 */
export function getBookingSlotPeriod(slot: string | null | undefined): SlotPeriodDetails {
  if (isFullDaySlot(slot)) {
    return {
      periodKey: "MORNING",
      order: 1,
      periodNameGu: "સવાર / આખો દિવસ",
      periodTitleGu: "🌅 સવારના સ્લોટ (Morning / Whole Day)",
      periodTitleEn: "Morning & Whole Day Timing Slots",
      periodTimeRange: "09:00 AM થી બીજા દિવસે 08:00 AM",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      dotColor: "#d97706",
      startMinutes: 540, // 09:00 AM
      isWholeDay: true,
      cleanLabel: WHOLE_DAY_SLOT_LABEL,
    };
  }

  const s = String(slot || "").trim();
  const rangeMatch = s.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );

  let startMin = 540; // default 09:00 AM
  let cleanLabel = s || WHOLE_DAY_SLOT_LABEL;

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

    const parsedStart = parseTimeToMinutes(startPart, defaultStartMeridiem);
    if (parsedStart !== null) {
      startMin = parsedStart;
    }
    cleanLabel = `${startPart} - ${endPart}`;
  } else {
    // Check legacy slot names
    const upper = s.toUpperCase();
    if (upper.includes("DAY_TIME") || upper.includes("MORNING")) {
      startMin = 360; // 06:00 AM
    } else if (upper.includes("AFTERNOON") || upper.includes("NOON")) {
      startMin = 780; // 01:00 PM
    } else if (upper.includes("NIGHT_TIME") || upper.includes("EVENING")) {
      startMin = 1080; // 06:00 PM
    } else if (upper.includes("NIGHT_HOLD") || upper.includes("DAY_REST")) {
      startMin = 1260; // 09:00 PM
    }
  }

  // Determine period based on startMin:
  // 300 to 719 min (05:00 AM to 11:59 AM) -> Morning
  // 720 to 1019 min (12:00 PM to 04:59 PM) -> Noon & Afternoon
  // >= 1020 min (05:00 PM onwards) or < 300 min (midnight to 04:59 AM) -> Night & Late Night
  if (startMin >= 300 && startMin < 720) {
    return {
      periodKey: "MORNING",
      order: 1,
      periodNameGu: "સવાર",
      periodTitleGu: "🌅 સવારના સ્લોટ (Morning Timing Slots)",
      periodTitleEn: "Morning Timing Slots",
      periodTimeRange: "06:00 AM – 12:00 PM",
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
      dotColor: "#d97706",
      startMinutes: startMin,
      isWholeDay: false,
      cleanLabel,
    };
  }

  if (startMin >= 720 && startMin < 1020) {
    return {
      periodKey: "AFTERNOON",
      order: 2,
      periodNameGu: "બપોર",
      periodTitleGu: "☀️ બપોરના સ્લોટ (Noon & Afternoon Timing Slots)",
      periodTitleEn: "Noon & Afternoon Timing Slots",
      periodTimeRange: "12:00 PM – 05:00 PM",
      badgeClass: "bg-sky-100 text-sky-900 border-sky-300",
      dotColor: "#0284c7",
      startMinutes: startMin,
      isWholeDay: false,
      cleanLabel,
    };
  }

  return {
    periodKey: "NIGHT",
    order: 3,
    periodNameGu: "સાંજ / રાત્રિ",
    periodTitleGu: "🌙 સાંજ અને રાત્રિના સ્લોટ (Night & Late Night Timing Slots)",
    periodTitleEn: "Night & Late Night Timing Slots",
    periodTimeRange: "05:00 PM – મોડી રાત્રિ",
    badgeClass: "bg-indigo-100 text-indigo-900 border-indigo-300",
    dotColor: "#6366f1",
    startMinutes: startMin,
    isWholeDay: false,
    cleanLabel,
  };
}

/**
 * Sorts any list of bookings chronologically:
 * 1. Morning slots first (starts before 12:00 PM / Whole Day starting 09:00 AM)
 * 2. Noon and Afternoon slots second (starts 12:00 PM - 05:00 PM)
 * 3. Night and Late Night slots third (starts 05:00 PM onwards)
 */
export function sortBookingsByTimePeriod(bookings: any[]): any[] {
  if (!bookings || bookings.length <= 1) return bookings || [];

  return [...bookings].sort((a, b) => {
    const periodA = getBookingSlotPeriod(a.slot);
    const periodB = getBookingSlotPeriod(b.slot);

    if (periodA.order !== periodB.order) {
      return periodA.order - periodB.order;
    }
    return periodA.startMinutes - periodB.startMinutes;
  });
}

export interface DayPeriodGroup {
  periodKey: TimePeriodKey;
  order: number;
  titleGu: string;
  titleEn: string;
  timeRangeGu: string;
  icon: string;
  headerBg: string;
  headerBorder: string;
  titleColor: string;
  badgeBg: string;
  dotColor: string;
  directBookings: any[];
  allActiveBookings: any[]; // includes whole day bookings that cover this period
}

/**
 * Groups day bookings into Morning, Noon & Afternoon, and Night & Late Night slots.
 */
export function groupDayBookingsByPeriods(bookings: any[]): DayPeriodGroup[] {
  const sorted = sortBookingsByTimePeriod(bookings);

  const morningDirect: any[] = [];
  const afternoonDirect: any[] = [];
  const nightDirect: any[] = [];
  const wholeDayBookings: any[] = [];

  sorted.forEach((b) => {
    const p = getBookingSlotPeriod(b.slot);
    if (p.isWholeDay) {
      wholeDayBookings.push(b);
      morningDirect.push(b);
    } else if (p.periodKey === "MORNING") {
      morningDirect.push(b);
    } else if (p.periodKey === "AFTERNOON") {
      afternoonDirect.push(b);
    } else {
      nightDirect.push(b);
    }
  });

  return [
    {
      periodKey: "MORNING",
      order: 1,
      titleGu: "સવારના સ્લોટ (Morning Timing Slots)",
      titleEn: "Morning Timing Slots",
      timeRangeGu: "06:00 AM – 12:00 PM",
      icon: "🌅",
      headerBg: "bg-amber-50/80",
      headerBorder: "border-amber-200",
      titleColor: "text-amber-950",
      badgeBg: "bg-amber-100 text-amber-900 border-amber-300",
      dotColor: "#d97706",
      directBookings: morningDirect,
      allActiveBookings: morningDirect,
    },
    {
      periodKey: "AFTERNOON",
      order: 2,
      titleGu: "બપોરના સ્લોટ (Noon & Afternoon Timing Slots)",
      titleEn: "Noon & Afternoon Timing Slots",
      timeRangeGu: "12:00 PM – 05:00 PM",
      icon: "☀️",
      headerBg: "bg-sky-50/80",
      headerBorder: "border-sky-200",
      titleColor: "text-sky-950",
      badgeBg: "bg-sky-100 text-sky-900 border-sky-300",
      dotColor: "#0284c7",
      directBookings: afternoonDirect,
      allActiveBookings: [...afternoonDirect, ...wholeDayBookings.filter((wb) => !afternoonDirect.some((ab) => ab.id === wb.id))],
    },
    {
      periodKey: "NIGHT",
      order: 3,
      titleGu: "સાંજ અને રાત્રિના સ્લોટ (Night & Late Night Timing Slots)",
      titleEn: "Night & Late Night Timing Slots",
      timeRangeGu: "05:00 PM – મોડી રાત્રિ",
      icon: "🌙",
      headerBg: "bg-indigo-50/80",
      headerBorder: "border-indigo-200",
      titleColor: "text-indigo-950",
      badgeBg: "bg-indigo-100 text-indigo-900 border-indigo-300",
      dotColor: "#6366f1",
      directBookings: nightDirect,
      allActiveBookings: [...nightDirect, ...wholeDayBookings.filter((wb) => !nightDirect.some((nb) => nb.id === wb.id))],
    },
  ];
}
