"use strict";
"use client";

import React, { useState, useMemo } from "react";
import { Clock, Check, X, Sunrise, Sunset } from "lucide-react";

export interface InteractiveClockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSlot: (slotString: string) => void;
  dateStr?: string;
  facilityName?: string;
}

function to24Hour(h12: number, ampm: "AM" | "PM"): number {
  if (ampm === "AM") {
    return h12 === 12 ? 0 : h12;
  } else {
    return h12 === 12 ? 12 : h12 + 12;
  }
}

export function InteractiveClockModal({
  isOpen,
  onClose,
  onAddSlot,
  dateStr,
  facilityName,
}: InteractiveClockModalProps) {
  // Target: "START" (શરૂ સમય) or "END" (અંત સમય)
  const [activeTarget, setActiveTarget] = useState<"START" | "END">("START");

  // Start Time State
  const [startHour, setStartHour] = useState<number>(4); // 4
  const [startMinute, setStartMinute] = useState<number>(0);
  const [startAmpm, setStartAmpm] = useState<"AM" | "PM">("PM"); // Default PM so 4 is 4:00 PM!

  // End Time State
  const [endHour, setEndHour] = useState<number>(7); // 7
  const [endMinute, setEndMinute] = useState<number>(0);
  const [endAmpm, setEndAmpm] = useState<"AM" | "PM">("PM");

  // Clock mode: "HOUR" or "MINUTE"
  const [dialMode, setDialMode] = useState<"HOUR" | "MINUTE">("HOUR");

  // Active values based on activeTarget
  const currentHour = activeTarget === "START" ? startHour : endHour;
  const currentMinute = activeTarget === "START" ? startMinute : endMinute;
  const currentAmpm = activeTarget === "START" ? startAmpm : endAmpm;

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

  const setCurrentAmpm = (ampm: "AM" | "PM") => {
    if (activeTarget === "START") {
      setStartAmpm(ampm);
    } else {
      setEndAmpm(ampm);
    }
  };

  // Format strings
  const formatSlot = (h: number, m: number, ampm: "AM" | "PM") => {
    const hStr = h < 10 ? `0${h}` : `${h}`;
    const mStr = m < 10 ? `0${m}` : `${m}`;
    const h24 = to24Hour(h, ampm);
    const h24Str = h24 < 10 ? `0${h24}` : `${h24}`;
    return {
      display12: `${hStr}:${mStr} ${ampm}`,
      display24: `${h24Str}:${mStr}`,
      period: ampm === "AM" ? (h === 12 || h < 6 ? "રાત્રિ" : "સવાર") : (h < 5 ? "બપોર" : "સાંજ/રાત્રિ"),
    };
  };

  const startFormatted = useMemo(
    () => formatSlot(startHour, startMinute, startAmpm),
    [startHour, startMinute, startAmpm]
  );
  const endFormatted = useMemo(
    () => formatSlot(endHour, endMinute, endAmpm),
    [endHour, endMinute, endAmpm]
  );

  // Duration in hours & minutes
  const durationInfo = useMemo(() => {
    const startMin = to24Hour(startHour, startAmpm) * 60 + startMinute;
    let endMin = to24Hour(endHour, endAmpm) * 60 + endMinute;

    if (endMin <= startMin) {
      endMin += 1440; // overnight / past midnight
    }

    const diff = endMin - startMin;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return {
      hours: hrs,
      minutes: mins,
      isNextDay: endMin >= 1440,
      label: mins > 0 ? `${hrs} કલાક ${mins} મિનિટ` : `${hrs} કલાક`,
    };
  }, [startHour, startMinute, startAmpm, endHour, endMinute, endAmpm]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const slotString = `${startFormatted.display12} - ${endFormatted.display12}`;
    onAddSlot(slotString);
    onClose();
  };

  // Clock Hand angle
  const handAngle =
    dialMode === "HOUR"
      ? (currentHour % 12) * 30 + (currentMinute / 60) * 30
      : currentMinute * 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border-2 border-red-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-800 to-amber-900 p-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Clock className="w-5 h-5 text-amber-300 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black leading-tight">
                સમય પસંદ કરો (Select Time)
              </h2>
              <p className="text-[11px] text-red-100 font-medium">
                {facilityName ? `${facilityName} • ` : ""}
                {dateStr || ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center font-bold text-base transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 text-xs">
          {/* 1. Start Time & End Time Selector Tabs */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Start Time Tab */}
            <button
              type="button"
              onClick={() => {
                setActiveTarget("START");
                setDialMode("HOUR");
              }}
              className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer ${
                activeTarget === "START"
                  ? "bg-red-50 border-red-600 shadow-xs ring-2 ring-red-400/30"
                  : "bg-slate-50 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500 uppercase">
                <span className="flex items-center gap-1">
                  <Sunrise className="w-3.5 h-3.5 text-red-700" />
                  ૧. શરૂ સમય (Start)
                </span>
                {activeTarget === "START" && (
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                )}
              </div>
              <div className="mt-1 text-lg sm:text-xl font-black font-mono text-slate-900">
                {startFormatted.display12}
              </div>
              <div className="text-[10px] text-slate-500 font-bold">
                ({startFormatted.period}) • {startFormatted.display24}
              </div>
            </button>

            {/* End Time Tab */}
            <button
              type="button"
              onClick={() => {
                setActiveTarget("END");
                setDialMode("HOUR");
              }}
              className={`p-3 rounded-2xl border-2 text-left transition cursor-pointer ${
                activeTarget === "END"
                  ? "bg-red-50 border-red-600 shadow-xs ring-2 ring-red-400/30"
                  : "bg-slate-50 border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500 uppercase">
                <span className="flex items-center gap-1">
                  <Sunset className="w-3.5 h-3.5 text-red-700" />
                  ૨. અંત સમય (End)
                </span>
                {activeTarget === "END" && (
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                )}
              </div>
              <div className="mt-1 text-lg sm:text-xl font-black font-mono text-slate-900">
                {endFormatted.display12}
              </div>
              <div className="text-[10px] text-slate-500 font-bold">
                ({endFormatted.period}) • {endFormatted.display24}
              </div>
            </button>
          </div>

          {/* 2. Big AM / PM Switcher (Crystal Clear - Never confusing) */}
          <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-black text-slate-700 px-2">
              {activeTarget === "START" ? "શરૂ સમય માટે:" : "અંત સમય માટે:"}
            </span>

            <div className="grid grid-cols-2 gap-1 w-56">
              <button
                type="button"
                onClick={() => setCurrentAmpm("AM")}
                className={`py-2 px-3 rounded-xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  currentAmpm === "AM"
                    ? "bg-red-800 text-white shadow-md ring-2 ring-red-400"
                    : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                <span>☀️ AM</span>
                <span className="text-[10px] opacity-80">(સવાર)</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentAmpm("PM")}
                className={`py-2 px-3 rounded-xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  currentAmpm === "PM"
                    ? "bg-red-800 text-white shadow-md ring-2 ring-red-400"
                    : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                <span>🌙 PM</span>
                <span className="text-[10px] opacity-80">(બપોર/સાંજ)</span>
              </button>
            </div>
          </div>

          {/* 3. Interactive Round Clock Face & Controls */}
          <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl space-y-3">
            {/* Hour / Minute Tab Toggle */}
            <div className="flex items-center justify-between w-full max-w-xs px-2">
              <span className="text-xs font-black text-slate-800">
                {dialMode === "HOUR" ? "કલાક પસંદ કરો (1 થી 12):" : "મિનિટ પસંદ કરો:"}
              </span>
              <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setDialMode("HOUR")}
                  className={`px-3 py-1 rounded-md text-xs font-black transition cursor-pointer ${
                    dialMode === "HOUR" ? "bg-red-800 text-white" : "text-slate-700"
                  }`}
                >
                  કલાક
                </button>
                <button
                  type="button"
                  onClick={() => setDialMode("MINUTE")}
                  className={`px-3 py-1 rounded-md text-xs font-black transition cursor-pointer ${
                    dialMode === "MINUTE" ? "bg-red-800 text-white" : "text-slate-700"
                  }`}
                >
                  મિનિટ
                </button>
              </div>
            </div>

            {/* SVG Circular Clock */}
            <div className="relative w-52 h-52 sm:w-56 sm:h-56 bg-white rounded-full border-4 border-slate-300 shadow-inner flex items-center justify-center select-none">
              {/* Center Pin */}
              <div className="absolute w-3.5 h-3.5 rounded-full bg-red-800 z-20 border-2 border-white shadow-xs" />

              {/* Hand */}
              <div
                className="absolute bottom-1/2 left-1/2 w-1.5 bg-red-800 origin-bottom rounded-t-full transition-transform duration-150 ease-out z-10"
                style={{
                  height: dialMode === "HOUR" ? "70px" : "85px",
                  transform: `translateX(-50%) rotate(${handAngle}deg)`,
                }}
              />

              {/* 12 Hour Numbers (Big, clear, easy to tap) */}
              {dialMode === "HOUR" &&
                Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
                  const angle = (h * 30 - 90) * (Math.PI / 180);
                  const radius = 80; // px
                  const x = 104 + radius * Math.cos(angle);
                  const y = 104 + radius * Math.sin(angle);
                  const isSelected = currentHour === h;

                  return (
                    <button
                      key={`h-${h}`}
                      type="button"
                      onClick={() => {
                        setCurrentHour(h);
                        setDialMode("MINUTE"); // switch to minute after selecting hour
                      }}
                      style={{
                        left: `${x}px`,
                        top: `${y}px`,
                        transform: "translate(-50%, -50%)",
                      }}
                      className={`absolute w-8 h-8 rounded-full text-sm font-black flex items-center justify-center transition cursor-pointer ${
                        isSelected
                          ? "bg-red-800 text-white shadow-md scale-110 ring-2 ring-red-400"
                          : "text-slate-800 hover:bg-red-50 hover:text-red-800"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}

              {/* Minute Marks (:00, :05, :10 ... :55) */}
              {dialMode === "MINUTE" &&
                [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
                  const angle = (m * 6 - 90) * (Math.PI / 180);
                  const radius = 80;
                  const x = 104 + radius * Math.cos(angle);
                  const y = 104 + radius * Math.sin(angle);
                  const isSelected = currentMinute === m;

                  return (
                    <button
                      key={`m-${m}`}
                      type="button"
                      onClick={() => setCurrentMinute(m)}
                      style={{
                        left: `${x}px`,
                        top: `${y}px`,
                        transform: "translate(-50%, -50%)",
                      }}
                      className={`absolute w-8 h-8 rounded-full text-xs font-black flex items-center justify-center transition cursor-pointer ${
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

            {/* Quick Minute Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">મિનિટ:</span>
              {[0, 15, 30, 45].map((m) => (
                <button
                  key={`btn-min-${m}`}
                  type="button"
                  onClick={() => setCurrentMinute(m)}
                  className={`px-3 py-1 rounded-xl text-xs font-black border transition cursor-pointer ${
                    currentMinute === m
                      ? "bg-red-800 text-white border-red-900 shadow-xs"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  :{m < 10 ? `0${m}` : m}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Slot Summary Preview */}
          <div className="bg-amber-50 border border-amber-300 p-3 rounded-2xl flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[10px] font-bold text-amber-900 uppercase block">
                પસંદ કરેલ સ્લોટ:
              </span>
              <span className="text-sm font-black text-amber-950 font-mono">
                {startFormatted.display12} થી {endFormatted.display12}
              </span>
            </div>

            <span className="px-2.5 py-1 rounded-xl bg-amber-200 text-amber-900 font-black text-xs border border-amber-300">
              ⏱️ {durationInfo.label}
              {durationInfo.isNextDay ? " (બીજા દિવસે)" : ""}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
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
            className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 active:bg-red-900 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>આ સમય ઉમેરો (+ Add Time)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
export default InteractiveClockModal;
