"use strict";
"use client";

import React, { useState, useMemo } from "react";
import { Clock, Check, X, Sparkles, Moon, Sun, Sunrise, Sunset } from "lucide-react";

export interface InteractiveClockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSlot: (slotString: string) => void;
  dateStr?: string;
  facilityName?: string;
}

// Quick Samaj Official Presets matching the Samaj Rate Sheet
const SAMAJ_PRESETS = [
  {
    label: "🌅 સવાર સ્લોટ (Morning Shift)",
    sub: "સવાર 01:00 AM થી બપોરે 02:00 PM (13 કલાક)",
    startH: 1,
    startM: 0,
    endH: 14,
    endM: 0,
  },
  {
    label: "🌙 સાંજ/રાત્રિ સ્લોટ (Evening Shift)",
    sub: "બપોરે 03:00 PM થી રાત્રે 12:00 AM (9 કલાક)",
    startH: 15,
    startM: 0,
    endH: 24, // midnight
    endM: 0,
  },
  {
    label: "☀️ બપોર સ્લોટ (Lunch / Afternoon)",
    sub: "બપોરે 12:00 PM થી 02:00 PM (2 કલાક)",
    startH: 12,
    startM: 0,
    endH: 14,
    endM: 0,
  },
  {
    label: "🌅 સાંજ સ્લોટ (Evening / Reception)",
    sub: "સાંજે 04:00 PM થી 07:00 PM (3 કલાક)",
    startH: 16,
    startM: 0,
    endH: 19,
    endM: 0,
  },
  {
    label: "🌙 રાત્રિ સ્લોટ (Late Evening / Dinner)",
    sub: "રાત્રે 07:00 PM થી 10:00 PM (3 કલાક)",
    startH: 19,
    startM: 0,
    endH: 22,
    endM: 0,
  },
  {
    label: "🌄 સવાર બેઠક (Morning Meeting)",
    sub: "સવારે 09:00 AM થી બપોરે 01:00 PM (4 કલાક)",
    startH: 9,
    startM: 0,
    endH: 13,
    endM: 0,
  },
];

// 24 Hour Day Sections (સમાજ સમયપત્રક મુજબ ૪ પ્રહર)
const DAY_SECTIONS = [
  {
    name: "સવાર (Morning)",
    icon: Sunrise,
    color: "amber",
    hours: [6, 7, 8, 9, 10, 11],
  },
  {
    name: "બપોર (Afternoon)",
    icon: Sun,
    color: "blue",
    hours: [12, 13, 14, 15, 16, 17],
  },
  {
    name: "સાંજ / રાત્રિ (Evening)",
    icon: Sunset,
    color: "indigo",
    hours: [18, 19, 20, 21, 22, 23],
  },
  {
    name: "મધ્યરાત્રિ / વહેલી સવાર (Late Night - સમાજ મુજબ)",
    icon: Moon,
    color: "purple",
    hours: [0, 1, 2, 3, 4, 5],
  },
];

function formatTimeDisplay(hour24: number, min: number): { time12: string; time24: string; periodLabel: string } {
  const normH = hour24 % 24;
  const mStr = min < 10 ? `0${min}` : `${min}`;

  // 24h string
  const h24Str = normH < 10 ? `0${normH}` : `${normH}`;
  const time24 = `${h24Str}:${mStr}`;

  // 12h string
  let h12 = normH % 12;
  if (h12 === 0) h12 = 12;
  const meridiem = normH >= 12 && normH < 24 ? "PM" : "AM";
  const h12Str = h12 < 10 ? `0${h12}` : `${h12}`;
  const time12 = `${h12Str}:${mStr} ${meridiem}`;

  let periodLabel = "સવાર";
  if (normH >= 12 && normH < 17) periodLabel = "બપોર";
  else if (normH >= 17 && normH < 22) periodLabel = "સાંજ";
  else if (normH >= 22 || normH < 5) periodLabel = "રાત્રિ";

  return { time12, time24, periodLabel };
}

export function InteractiveClockModal({
  isOpen,
  onClose,
  onAddSlot,
  dateStr,
  facilityName,
}: InteractiveClockModalProps) {
  // Active selection target: "START" or "END"
  const [activeTarget, setActiveTarget] = useState<"START" | "END">("START");

  // Selected time state in 24h
  const [startHour, setStartHour] = useState<number>(9); // 09:00 AM
  const [startMinute, setStartMinute] = useState<number>(0);

  const [endHour, setEndHour] = useState<number>(14); // 02:00 PM
  const [endMinute, setEndMinute] = useState<number>(0);

  // Clock Dial Face Mode: "HOUR" or "MINUTE"
  const [dialMode, setDialMode] = useState<"HOUR" | "MINUTE">("HOUR");

  // Format preference toggle: "24H" or "12H"
  const [displayFormat, setDisplayFormat] = useState<"24H" | "12H">("12H");

  const currentHour = activeTarget === "START" ? startHour : endHour;
  const currentMinute = activeTarget === "START" ? startMinute : endMinute;

  const setCurrentHour = (h: number) => {
    if (activeTarget === "START") {
      setStartHour(h);
    } else {
      setEndHour(h);
    }
  };

  const setCurrentMinute = (m: number) => {
    if (activeTarget === "START") {
      setStartMinute(m);
    } else {
      setEndMinute(m);
    }
  };

  const startFormatted = useMemo(
    () => formatTimeDisplay(startHour, startMinute),
    [startHour, startMinute]
  );
  const endFormatted = useMemo(
    () => formatTimeDisplay(endHour, endMinute),
    [endHour, endMinute]
  );

  // Duration calculation in hours & minutes
  const durationInfo = useMemo(() => {
    let startMin = (startHour % 24) * 60 + startMinute;
    let endMin = (endHour % 24) * 60 + endMinute;

    // Special case for midnight 24:00 / 00:00 ending
    if (endHour === 24) {
      endMin = 24 * 60 + endMinute;
    } else if (endMin <= startMin) {
      endMin += 1440; // spans past midnight
    }

    const diff = endMin - startMin;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return {
      totalMinutes: diff,
      hours: hrs,
      minutes: mins,
      isNextDay: endMin >= 1440,
      label: mins > 0 ? `${hrs} કલાક ${mins} મિનિટ` : `${hrs} કલાક`,
    };
  }, [startHour, startMinute, endHour, endMinute]);

  if (!isOpen) return null;

  const handleApplyPreset = (p: (typeof SAMAJ_PRESETS)[0]) => {
    setStartHour(p.startH);
    setStartMinute(p.startM);
    setEndHour(p.endH);
    setEndMinute(p.endM);
  };

  const handleConfirm = () => {
    // Generate clean Samaj standard slot label
    const slotString = `${startFormatted.time12} - ${endFormatted.time12}`;
    onAddSlot(slotString);
    onClose();
  };

  // Clock Hand angle calculation
  const handAngle =
    dialMode === "HOUR"
      ? (currentHour % 12) * 30 + (currentMinute / 60) * 30
      : currentMinute * 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border-2 border-red-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-900 via-red-800 to-amber-900 p-4 sm:p-5 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <Clock className="w-5 h-5 text-amber-300 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full shadow-2xs">
                  ૨૪ કલાક ઘડિયાળ (24-Hour Clock)
                </span>
                {dateStr && (
                  <span className="text-xs text-amber-200 font-mono font-bold">
                    {dateStr}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black leading-tight pt-0.5">
                ચોક્કસ કસ્ટમ સમય પસંદ કરો (Interactive Slot Picker)
              </h2>
              {facilityName && (
                <p className="text-[11px] text-red-100/90 font-medium">
                  સુવિધા: <span className="font-bold underline">{facilityName}</span>
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center font-bold text-lg transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Dual Time Selector Bar (Start Time ➔ End Time) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border-2 border-slate-200 shadow-2xs">
            {/* Start Time Card */}
            <button
              type="button"
              onClick={() => setActiveTarget("START")}
              className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                activeTarget === "START"
                  ? "bg-red-50 border-red-600 shadow-xs ring-2 ring-red-400/40"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Sunrise className="w-3.5 h-3.5 text-red-700" />
                  ૧. શરૂ સમય (Start Time)
                </span>
                {activeTarget === "START" && (
                  <span className="text-[9px] font-black bg-red-700 text-white px-2 py-0.5 rounded-full">
                    સક્રિય પસંદગી
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {displayFormat === "24H" ? startFormatted.time24 : startFormatted.time12}
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  ({startFormatted.periodLabel})
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                ૨૪ કલાક: {startFormatted.time24} • ૧૨ કલાક: {startFormatted.time12}
              </span>
            </button>

            {/* End Time Card */}
            <button
              type="button"
              onClick={() => setActiveTarget("END")}
              className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                activeTarget === "END"
                  ? "bg-red-50 border-red-600 shadow-xs ring-2 ring-red-400/40"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Sunset className="w-3.5 h-3.5 text-red-700" />
                  ૨. અંત સમય (End Time)
                </span>
                {activeTarget === "END" && (
                  <span className="text-[9px] font-black bg-red-700 text-white px-2 py-0.5 rounded-full">
                    સક્રિય પસંદગી
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {displayFormat === "24H" ? endFormatted.time24 : endFormatted.time12}
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  ({endFormatted.periodLabel})
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                ૨૪ કલાક: {endFormatted.time24} • ૧૨ કલાક: {endFormatted.time12}
              </span>
            </button>
          </div>

          {/* Slot Duration & Mode Summary Banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 p-2.5 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                ⏱️
              </span>
              <div>
                <span className="text-xs font-black text-amber-950">
                  કુલ સમયગાળો: {durationInfo.label}
                </span>
                {durationInfo.isNextDay && (
                  <span className="text-[10px] text-amber-800 font-bold ml-1.5 bg-amber-200 px-1.5 py-0.2 rounded">
                    (બીજા દિવસે વહેલી સવાર સુધી)
                  </span>
                )}
              </div>
            </div>

            {/* Format Toggle (12H vs 24H) */}
            <div className="flex items-center gap-1 bg-white border border-amber-300 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setDisplayFormat("12H")}
                className={`px-2 py-1 rounded-md text-[10px] font-extrabold transition cursor-pointer ${
                  displayFormat === "12H"
                    ? "bg-red-800 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                ૧૨ કલાક (AM/PM)
              </button>
              <button
                type="button"
                onClick={() => setDisplayFormat("24H")}
                className={`px-2 py-1 rounded-md text-[10px] font-extrabold transition cursor-pointer ${
                  displayFormat === "24H"
                    ? "bg-red-800 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                ૨૪ કલાક (00-23)
              </button>
            </div>
          </div>

          {/* Middle: Interactive Clock Face + Fast 24-Hour Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Left: Interactive Analog Clock Face (5 cols) */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl">
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-[10px] font-bold text-slate-700">
                  {activeTarget === "START" ? "🟢 શરૂ સમય ઘડિયાળ" : "🔴 અંત સમય ઘડિયાળ"}
                </span>
                <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setDialMode("HOUR")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      dialMode === "HOUR" ? "bg-red-800 text-white" : "text-slate-700"
                    }`}
                  >
                    કલાક
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialMode("MINUTE")}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      dialMode === "MINUTE" ? "bg-red-800 text-white" : "text-slate-700"
                    }`}
                  >
                    મિનિટ
                  </button>
                </div>
              </div>

              {/* SVG Clock Dial */}
              <div className="relative w-48 h-48 sm:w-52 sm:h-52 bg-white rounded-full border-4 border-slate-300 shadow-inner flex items-center justify-center select-none">
                {/* Center Pivot */}
                <div className="absolute w-3.5 h-3.5 rounded-full bg-red-800 z-20 border-2 border-white shadow-xs" />

                {/* Clock Hand */}
                <div
                  className="absolute bottom-1/2 left-1/2 w-1 bg-red-800 origin-bottom rounded-t-full transition-transform duration-200 ease-out z-10"
                  style={{
                    height: dialMode === "HOUR" ? "64px" : "80px",
                    transform: `translateX(-50%) rotate(${handAngle}deg)`,
                  }}
                />

                {/* Numbers for 1 to 12 (Hour Dial) */}
                {dialMode === "HOUR" &&
                  Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
                    const angle = (h * 30 - 90) * (Math.PI / 180);
                    const radius = 72; // px from center
                    const x = 96 + radius * Math.cos(angle);
                    const y = 96 + radius * Math.sin(angle);
                    const isSelected = (currentHour % 12 || 12) === h;

                    return (
                      <button
                        key={`dial-h-${h}`}
                        type="button"
                        onClick={() => {
                          // Preserve PM/AM based on current selection
                          const isPm = currentHour >= 12;
                          let newH = h;
                          if (h === 12) {
                            newH = isPm ? 12 : 0;
                          } else {
                            newH = isPm ? h + 12 : h;
                          }
                          setCurrentHour(newH);
                          setDialMode("MINUTE"); // auto-switch to minute after picking hour
                        }}
                        style={{
                          left: `${x}px`,
                          top: `${y}px`,
                          transform: "translate(-50%, -50%)",
                        }}
                        className={`absolute w-7 h-7 rounded-full text-xs font-black flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? "bg-red-800 text-white shadow-md scale-110 ring-2 ring-red-400"
                            : "text-slate-800 hover:bg-red-50 hover:text-red-800"
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}

                {/* Minutes Dial (:00, :15, :30, :45) */}
                {dialMode === "MINUTE" &&
                  [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
                    const angle = (m * 6 - 90) * (Math.PI / 180);
                    const radius = 72;
                    const x = 96 + radius * Math.cos(angle);
                    const y = 96 + radius * Math.sin(angle);
                    const isSelected = currentMinute === m;

                    return (
                      <button
                        key={`dial-m-${m}`}
                        type="button"
                        onClick={() => setCurrentMinute(m)}
                        style={{
                          left: `${x}px`,
                          top: `${y}px`,
                          transform: "translate(-50%, -50%)",
                        }}
                        className={`absolute w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? "bg-red-800 text-white shadow-md scale-110 ring-2 ring-red-400"
                            : "text-slate-800 hover:bg-red-50 hover:text-red-800"
                        }`}
                      >
                        {m < 10 ? `0${m}` : m}
                      </button>
                    );
                  })}
              </div>

              {/* Quick Minutes row */}
              <div className="flex items-center gap-1.5 mt-3">
                <span className="text-[10px] font-bold text-slate-500">મિનિટ:</span>
                {[0, 15, 30, 45].map((m) => (
                  <button
                    key={`btn-m-${m}`}
                    type="button"
                    onClick={() => setCurrentMinute(m)}
                    className={`px-2 py-1 rounded-lg text-xs font-black border transition cursor-pointer ${
                      currentMinute === m
                        ? "bg-red-800 text-white border-red-900 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    :{m < 10 ? `0${m}` : m}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: 24-Hour Samaj Shift Quick Grid (7 cols) */}
            <div className="md:col-span-7 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  ૨૪ કલાક સમયપત્રક (સમાજ મુજબ પ્રહર):
                </span>
                <span className="text-[10px] text-slate-500 font-bold">
                  કોઈપણ કલાક પર ૧ ક્લિક કરો
                </span>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {DAY_SECTIONS.map((sec) => {
                  const Icon = sec.icon;
                  return (
                    <div
                      key={sec.name}
                      className="p-2 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-red-800" />
                          <span>{sec.name}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-6 gap-1 text-center">
                        {sec.hours.map((h) => {
                          const isSelected = currentHour === h;
                          const h12 = h % 12 || 12;
                          const ampm = h >= 12 && h < 24 ? "PM" : "AM";
                          const label24 = h < 10 ? `0${h}:00` : `${h}:00`;
                          const label12 = `${h12} ${ampm}`;

                          return (
                            <button
                              key={`grid-h-${h}`}
                              type="button"
                              onClick={() => {
                                setCurrentHour(h);
                                setDialMode("MINUTE");
                              }}
                              className={`p-1.5 rounded-lg border text-center transition cursor-pointer ${
                                isSelected
                                  ? "bg-red-800 text-white border-red-900 shadow-xs ring-1 ring-red-400"
                                  : "bg-white text-slate-800 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              <div className="text-[11px] font-black font-mono leading-none">
                                {label24}
                              </div>
                              <div className="text-[9px] opacity-80 mt-0.5 leading-none">
                                {label12}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom: Samaj Official Shift Presets */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-900">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>સમાજના પ્રચલિત સ્લોટ્સ (Samaj Official Presets):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
              {SAMAJ_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:border-red-400 hover:bg-red-50/50 text-left transition cursor-pointer shadow-2xs group"
                >
                  <div className="font-bold text-slate-900 group-hover:text-red-900 flex items-center justify-between">
                    <span>{preset.label}</span>
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                      લાગુ કરો
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {preset.sub}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">પસંદ કરેલ સ્લોટ:</span>
            <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-950 font-black font-mono text-xs border border-red-200 shadow-2xs">
              {startFormatted.time12} થી {endFormatted.time12}
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              ({durationInfo.label})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 font-bold text-xs transition cursor-pointer shadow-2xs"
            >
              રદ કરો (Cancel)
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-700 via-red-800 to-amber-900 hover:from-red-600 hover:to-amber-800 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>આ સ્લોટ ઉમેરો (+ Add This Slot)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default InteractiveClockModal;
