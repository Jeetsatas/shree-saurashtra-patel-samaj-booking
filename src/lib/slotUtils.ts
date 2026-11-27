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

export const AM_HOURS = [
  "12:00 AM", "12:30 AM", "01:00 AM", "01:30 AM", "02:00 AM", "02:30 AM",
  "03:00 AM", "03:30 AM", "04:00 AM", "04:30 AM", "05:00 AM", "05:30 AM",
  "06:00 AM", "06:30 AM", "07:00 AM", "07:30 AM", "08:00 AM", "08:30 AM",
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"
];

export const PM_HOURS = [
  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
  "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM",
  "09:00 PM", "09:30 PM", "10:00 PM", "10:30 PM", "11:00 PM", "11:30 PM"
];

export const STANDARD_HOURS = [...AM_HOURS, ...PM_HOURS];

export const TIMING_PRESETS = [
  { label: "01:00 AM - 02:00 PM (13 કલાક - સવાર)", from: "01:00 AM", to: "02:00 PM" },
  { label: "03:00 PM - 12:00 AM (9 કલાક - સાંજ)", from: "03:00 PM", to: "12:00 AM" },
  { label: "12:00 PM - 02:00 PM (2 કલાક)", from: "12:00 PM", to: "02:00 PM" },
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

/**
 * Checks whether a facility represents the Ground Floor Hall.
 */
export function isGroundFloorHall(
  facility?: { code?: string | null; name?: string | null } | null
): boolean {
  if (!facility) return false;
  const code = (facility.code || "").toUpperCase();
  const name = (facility.name || "").toLowerCase();
  return (
    code === "HALL-GROUND-FLOOR" ||
    code === "RESOURCE_HALL_GROUND" ||
    name.includes("ground floor") ||
    name.includes("ગ્રાઉન્ડ ફ્લોર")
  );
}

/**
 * Returns whether a Ground Floor Hall booking has AC or Non-AC selected.
 * Returns null if the booking is not for the Ground Floor Hall.
 */
export function getBookingGroundHallOption(b?: {
  facility?: { code?: string | null; name?: string | null } | null;
  facilityCode?: string | null;
  facilityName?: string | null;
  notes?: string | null;
  selectedServices?: string | null;
} | null): "AC" | "NON_AC" | null {
  if (!b) return null;
  const facCode = b.facility?.code || b.facilityCode;
  const facName = b.facility?.name || b.facilityName;
  const isGround = isGroundFloorHall({ code: facCode, name: facName });
  if (!isGround) return null;

  const notes = b.notes || "";
  const servStr = b.selectedServices || "";
  if (
    notes.includes("[Ground Floor Hall: AC]") ||
    notes.includes("Ground Floor Hall: AC") ||
    notes.includes("Ground Floor Hall (AC)") ||
    servStr.includes("HALL_OPTION_AC") ||
    servStr.includes("Ground Floor Hall (AC)")
  ) {
    return "AC";
  }
  return "NON_AC";
}

export interface JamaEntry {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  method?: string; // CASH_AT_OFFICE | UPI_BANK_TRANSFER | CHEQUE | ONLINE
  refNo?: string;
  notes?: string;
  createdAt?: string;
}

export function parseJamaEntries(notesText?: string | null): JamaEntry[] {
  if (!notesText) return [];
  const match = notesText.match(/<!--JAMA_ENTRIES:([\s\S]*?)-->/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setJamaEntriesInNotes(
  notesText: string | null | undefined,
  entries: JamaEntry[]
): string {
  const current = (notesText || "").replace(/<!--JAMA_ENTRIES:[\s\S]*?-->/g, "").trim();
  if (!entries || entries.length === 0) return current;
  const tag = `<!--JAMA_ENTRIES:${JSON.stringify(entries)}-->`;
  return current ? `${current}\n${tag}` : tag;
}

export function getCleanNotesWithoutTags(notesText?: string | null): string {
  if (!notesText) return "";
  return notesText
    .replace(/<!--JAMA_ENTRIES:[\s\S]*?-->/g, "")
    .replace(/\[Ground Floor Hall: (AC|Non-AC)\]/g, "")
    .trim();
}

/**
 * Standard facility rate calculation matching the Samaj Rate Sheet.
 */
export function getStandardFacilityRate(
  facility: { code?: string | null; baseRent?: number | null; weddingRent?: number | null; familyRent?: number | null } | null | undefined,
  slot?: string | null,
  eventType?: string | null
): number {
  if (!facility) return 0;
  const code = facility.code || "";
  const isFull = isFullDaySlot(slot);

  if (code === "PLOT-OUTSIDE") {
    const ev = (eventType || "").toLowerCase();
    const isWed = ev.includes("wedding") || ev.includes("lagna") || ev.includes("reception") || ev.includes("mandap") || ev.includes("wedd");
    return isWed ? (facility.weddingRent || 51000) : (facility.familyRent || 21000);
  }
  if (code === "HALL-MULTIPURPOSE") {
    return isFull ? 31000 : 21000;
  }
  if (code === "HALL-GROUND-FLOOR") {
    return isFull ? 150000 : 100000;
  }
  if (code === "DORM-42-BEDS") return 16000;
  if (code === "DORM-28-BEDS") return 11000;
  if (code === "ROOM-8BED-UNIT1") return 3000;
  if (code === "ROOM-6BED") return 2500;
  if (code === "ROOM-8BED-UNIT2") return 3000;

  return facility.baseRent || 0;
}

/**
 * Calculates standard event deposit. If major facility (Halls, Party Plot, Dormitories)
 * is booked, event caution deposit is standard ₹25,000.
 */
export function calculateEventDeposit(
  facilitiesList: Array<{ code?: string | null; cautionDeposit?: number | null }>
): number {
  const hasMajorFacility = facilitiesList.some((f) => {
    const c = f?.code || "";
    return c === "PLOT-OUTSIDE" || c === "HALL-GROUND-FLOOR" || c === "HALL-MULTIPURPOSE" || c.startsWith("DORM");
  });
  if (hasMajorFacility) return 25000;
  return Math.max(0, ...facilitiesList.map((f) => f?.cautionDeposit || 0));
}

export interface PartyBookingGroup {
  partyKey: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  customerAadhar?: string;
  eventType?: string;
  dateRange: {
    startDate: string;
    endDate: string;
    daysCount: number;
    label: string;
  };
  bookings: any[];
  bookingIds: string[];
  total: number;
  discountAmount: number;
  totalWithDiscount: number;
  deposit: number;
  net: number;
  jamaEntries: JamaEntry[];
  totalJama: number;
  netRemaining: number;
  paymentStatus: "PAID" | "PARTIAL" | "PENDING";
  latestJamaDate?: string;
}

/**
 * Groups bookings by Party (Customer & Event Dates session) for comprehensive
 * financial accounting in પેમેન્ટ સ્થિતિ (Payment Status).
 */
export function groupBookingsByParty(allBookings: any[]): PartyBookingGroup[] {
  const activeBookings = (allBookings || []).filter((b) => b.status !== "CANCELLED");

  // Helper to normalize phone
  const cleanPhone = (p?: string | null) => (p || "").replace(/\D/g, "");

  // Sort chronologically
  const sorted = [...activeBookings].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  const groups: PartyBookingGroup[] = [];

  for (const b of sorted) {
    const phone = cleanPhone(b.customerPhone);
    const name = (b.customerName || "").trim().toLowerCase();
    const bStart = new Date(b.startDate).getTime();

    // Find an existing group where phone matches (or name matches if no phone)
    // and event start is within 10 days of the group's range
    let targetGroup = groups.find((g) => {
      const gPhone = cleanPhone(g.customerPhone);
      const gName = (g.customerName || "").trim().toLowerCase();
      const phoneMatch = phone && gPhone && phone === gPhone;
      const nameMatch = !phone && !gPhone && name && gName && name === gName;

      if (!phoneMatch && !nameMatch) return false;

      const groupStart = new Date(g.dateRange.startDate).getTime();
      const groupEnd = new Date(g.dateRange.endDate).getTime();
      const diffStart = Math.abs(bStart - groupStart) / (1000 * 60 * 60 * 24);
      const diffEnd = Math.abs(bStart - groupEnd) / (1000 * 60 * 60 * 24);

      return diffStart <= 12 || diffEnd <= 12;
    });

    if (!targetGroup) {
      targetGroup = {
        partyKey: `${phone || name || b.id}-${b.startDate}`,
        customerName: b.customerName || "અજ્ઞાત અરજદાર",
        customerPhone: b.customerPhone || "",
        customerEmail: b.customerEmail || "",
        customerAddress: b.customerAddress || "",
        customerAadhar: b.customerAadhar || "",
        eventType: b.eventType || "Event",
        dateRange: {
          startDate: b.startDate,
          endDate: b.endDate || b.startDate,
          daysCount: 1,
          label: "",
        },
        bookings: [],
        bookingIds: [],
        total: 0,
        discountAmount: 0,
        totalWithDiscount: 0,
        deposit: 0,
        net: 0,
        jamaEntries: [],
        totalJama: 0,
        netRemaining: 0,
        paymentStatus: "PENDING",
      };
      groups.push(targetGroup);
    }

    targetGroup.bookings.push(b);
    targetGroup.bookingIds.push(b.id);

    // Expand date range if needed
    if (new Date(b.startDate) < new Date(targetGroup.dateRange.startDate)) {
      targetGroup.dateRange.startDate = b.startDate;
    }
    const bEnd = b.endDate || b.startDate;
    if (new Date(bEnd) > new Date(targetGroup.dateRange.endDate)) {
      targetGroup.dateRange.endDate = bEnd;
    }
  }

  // Second pass: Calculate financials and format for each group
  for (const g of groups) {
    const sDate = new Date(g.dateRange.startDate);
    const eDate = new Date(g.dateRange.endDate);
    const dayMs = 1000 * 60 * 60 * 24;
    const diffDays = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / dayMs) + 1);
    g.dateRange.daysCount = diffDays;

    const sFmt = sDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const eFmt = eDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    g.dateRange.label = sFmt === eFmt ? sFmt : `${sFmt} થી ${eFmt} (${diffDays} દિવસ)`;

    // Calculate total base rent & services
    let sumBase = 0;
    let sumDiscounts = 0;
    const facilitiesList: any[] = [];

    for (const b of g.bookings) {
      const bFacAmt = Number(b.facilityAmount ?? b.totalAmount ?? 0);
      const bServAmt = Number(b.servicesAmount ?? 0);
      sumBase += bFacAmt + bServAmt;
      sumDiscounts += Number(b.discountAmount ?? 0);
      if (b.facility) facilitiesList.push(b.facility);
    }

    g.total = sumBase;
    g.discountAmount = sumDiscounts;
    g.totalWithDiscount = Math.max(0, g.total - g.discountAmount);

    // Calculate caution deposit (Use explicit booking deposit if set by trustee)
    const explicitDep = g.bookings.reduce((max, b) => Math.max(max, Number(b.depositAmount || 0)), 0);
    g.deposit = explicitDep > 0 ? explicitDep : calculateEventDeposit(facilitiesList);

    // Net = Total with discount + Deposit
    g.net = g.totalWithDiscount + g.deposit;

    // Collect all unique Jama entries from notes across party bookings
    const jamaMap = new Map<string, JamaEntry>();
    for (const b of g.bookings) {
      const entries = parseJamaEntries(b.notes);
      for (const ent of entries) {
        if (ent && ent.id) {
          jamaMap.set(ent.id, ent);
        }
      }
    }

    const jamaList = Array.from(jamaMap.values()).sort(
      (a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime()
    );
    g.jamaEntries = jamaList;

    const totalJama = jamaList.reduce((acc, ent) => acc + (Number(ent.amount) || 0), 0);
    g.totalJama = totalJama;

    // Net Remaining = Net - Total Jama
    g.netRemaining = Math.max(0, g.net - totalJama);

    if (jamaList.length > 0) {
      g.latestJamaDate = jamaList[0].date;
    }

    // Status evaluation
    if (g.netRemaining <= 0 && g.net > 0) {
      g.paymentStatus = "PAID";
    } else if (totalJama > 0) {
      g.paymentStatus = "PARTIAL";
    } else {
      g.paymentStatus = "PENDING";
    }
  }

  // Sort groups: newest events first
  return groups.sort(
    (a, b) => new Date(b.dateRange.startDate).getTime() - new Date(a.dateRange.startDate).getTime()
  );
}

/**
 * Strips common honorific prefixes like "શ્રી", "શ્રીમતી", "કુમારી", "Shree", "Shri", "Mr.", etc.
 * to extract the actual root name for phone diary alphabetical indexing.
 */
export function getCleanPartyName(fullName: string): string {
  if (!fullName) return "";
  return fullName
    .replace(/^(\s*(?:શ્રી|શ્રીમતી|કુમારી|shree|shri|smt|mr\.?|mrs\.?|ms\.?|dr\.?)\s+)/i, "")
    .trim();
}

export const GUJARATI_TO_ENGLISH_LETTER_MAP: Record<string, string> = {
  // Vowels
  "અ": "A", "આ": "A", "ઇ": "I", "ઈ": "I", "ઉ": "U", "ઊ": "U", "ઋ": "R", "એ": "E", "ઐ": "AI", "ઓ": "O", "ઔ": "AU",
  // Consonants
  "ક": "K", "ખ": "KH", "ગ": "G", "ઘ": "GH", "ઙ": "N",
  "ચ": "CH", "છ": "CH", "જ": "J", "ઝ": "Z", "ઞ": "N",
  "ટ": "T", "ઠ": "TH", "ડ": "D", "ઢ": "DH", "ણ": "N",
  "ત": "T", "થ": "TH", "દ": "D", "ધ": "DH", "ન": "N",
  "પ": "P", "ફ": "F", "બ": "B", "ભ": "BH", "મ": "M",
  "ય": "Y", "ર": "R", "લ": "L", "ળ": "L", "વ": "V",
  "શ": "SH", "ષ": "SH", "સ": "S", "હ": "H",
};

/**
 * Returns the primary sorting/indexing letter info for phone diary navigation.
 */
export function getPartyIndexLetter(fullName: string): {
  gujarati: string;
  english: string;
  displayLabel: string;
  primaryKey: string;
} {
  const clean = getCleanPartyName(fullName);
  if (!clean) return { gujarati: "#", english: "#", displayLabel: "#", primaryKey: "#" };

  const firstChar = clean.charAt(0);
  const upper = firstChar.toUpperCase();

  // If English letter
  if (upper >= "A" && upper <= "Z") {
    return {
      gujarati: upper,
      english: upper,
      displayLabel: upper,
      primaryKey: upper,
    };
  }

  // If Gujarati letter
  if (GUJARATI_TO_ENGLISH_LETTER_MAP[firstChar]) {
    const eng = GUJARATI_TO_ENGLISH_LETTER_MAP[firstChar];
    return {
      gujarati: firstChar,
      english: eng,
      displayLabel: `${firstChar} (${eng})`,
      primaryKey: firstChar,
    };
  }

  return {
    gujarati: firstChar,
    english: firstChar,
    displayLabel: firstChar,
    primaryKey: firstChar,
  };
}



