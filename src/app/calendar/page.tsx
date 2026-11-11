"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/date-utils";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Megaphone,
  Receipt,
  X,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

export default function CalendarPage() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12
  const [loading, setLoading] = useState(true);
  const [dailyDataMap, setDailyDataMap] = useState<Map<string, any>>(new Map());

  // Detail Modal
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateDetails, setDateDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const yearMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  const fetchMonthData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/date-wise?preset=custom&startDate=${yearMonth}-01&endDate=${yearMonth}-31`);
      const data = await res.json();
      if (data.success && data.report) {
        const map = new Map<string, any>();
        for (const r of data.report) {
          map.set(r.date, r);
        }
        setDailyDataMap(map);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    fetchMonthData();
  }, [fetchMonthData]);

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const openDateDetail = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/reports/date-wise/${dateStr}`);
      const data = await res.json();
      if (data.success) {
        setDateDetails(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Generate calendar grid days
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <span>Financial Calendar View</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Daily profit & loss audit visualized on a calendar month grid
          </p>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-2 bg-secondary/80 border p-1 rounded-2xl">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-xl hover:bg-card text-muted-foreground hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-xs sm:text-sm px-3 min-w-[130px] text-center">
            {monthNames[currentMonth - 1]} {currentYear}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-xl hover:bg-card text-muted-foreground hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b bg-secondary/60 text-center py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Calendar Day Cells */}
        <div className="grid grid-cols-7 divide-x divide-y border-b">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[90px] sm:min-h-[115px] bg-secondary/20 p-2 opacity-30" />
          ))}

          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${yearMonth}-${String(dayNum).padStart(2, "0")}`;
            const dayData = dailyDataMap.get(dateStr);
            const hasData = Boolean(dayData && (dayData.revenue > 0 || dayData.adSpend > 0 || dayData.otherExpenses > 0));
            const isProfit = dayData ? dayData.profit >= 0 : true;

            return (
              <div
                key={dateStr}
                onClick={() => hasData && openDateDetail(dateStr)}
                className={`min-h-[90px] sm:min-h-[115px] p-2 flex flex-col justify-between transition-colors ${
                  hasData
                    ? "cursor-pointer hover:bg-secondary/50 group"
                    : "hover:bg-secondary/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                    hasData
                      ? isProfit
                        ? "bg-emerald-500/10 text-emerald-500 font-extrabold"
                        : "bg-rose-500/10 text-rose-500 font-extrabold"
                      : "text-muted-foreground"
                  }`}>
                    {dayNum}
                  </span>
                  {hasData && (
                    <span className={`text-[10px] font-bold hidden sm:inline ${
                      isProfit ? "text-emerald-500" : "text-rose-500"
                    }`}>
                      {isProfit ? "+" : ""}{formatCurrency(dayData.profit)}
                    </span>
                  )}
                </div>

                {hasData ? (
                  <div className="space-y-0.5 text-[10px] pt-1">
                    {dayData.revenue > 0 && (
                      <div className="text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                        Rev: {formatCurrency(dayData.revenue)}
                      </div>
                    )}
                    {dayData.adSpend > 0 && (
                      <div className="text-blue-500 font-medium truncate">
                        Ads: {formatCurrency(dayData.adSpend)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground/40 font-mono">--</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Date Drilldown Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div>
                <h3 className="font-bold text-base">Date Audit: {selectedDate}</h3>
                <p className="text-xs text-muted-foreground">Detailed financial breakdown</p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="p-1 text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : dateDetails ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-secondary/50 border space-y-2">
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">Total Revenue (Gross):</span>
                    <span className="font-bold text-foreground">{formatCurrency(dateDetails.summary.totalGrossRevenue)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">Net Revenue Earned:</span>
                    <span className="font-bold text-emerald-500">{formatCurrency(dateDetails.summary.totalNetRevenue)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">Facebook Ad Spend:</span>
                    <span className="font-bold text-blue-500">{formatCurrency(dateDetails.summary.totalAds)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">Other Expenses:</span>
                    <span className="font-bold text-amber-500">{formatCurrency(dateDetails.summary.totalOther)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm pt-2 border-t">
                    <span>Net Profit / Loss:</span>
                    <span className={dateDetails.summary.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"}>
                      {formatCurrency(dateDetails.summary.netProfit)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
