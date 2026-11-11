"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getDateRangeFromPreset } from "@/lib/date-utils";

export interface DateFilterContextType {
  preset: string;
  setPreset: (preset: string) => void;
  startDate: string;
  endDate: string;
  setCustomRange: (start: string, end: string) => void;
  productId: string;
  setProductId: (id: string) => void;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export function DateFilterProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPresetState] = useState<string>("all_time");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [productId, setProductId] = useState<string>("all");

  const [dateRange, setDateRange] = useState(() => getDateRangeFromPreset("all_time"));

  useEffect(() => {
    const range = getDateRangeFromPreset(preset, customStart, customEnd);
    setDateRange(range);
  }, [preset, customStart, customEnd]);

  const setPreset = (p: string) => {
    setPresetState(p);
  };

  const setCustomRange = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    setPresetState("custom");
  };

  return (
    <DateFilterContext.Provider
      value={{
        preset,
        setPreset,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        setCustomRange,
        productId,
        setProductId,
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDateFilter() {
  const context = useContext(DateFilterContext);
  if (!context) {
    throw new Error("useDateFilter must be used within DateFilterProvider");
  }
  return context;
}
