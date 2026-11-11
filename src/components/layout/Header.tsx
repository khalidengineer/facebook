"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDateFilter } from "@/components/providers/DateFilterProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Calendar, Plus, Wifi, WifiOff, Sun, Moon, Filter, RefreshCw, Table, AlertTriangle, ChevronDown, Check } from "lucide-react";

const PRESET_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "all_time", label: "All Time" },
  { value: "custom", label: "Custom Range..." },
];

interface HeaderProps {
  title?: string;
  onOpenQuickAdd: () => void;
}

export function Header({ title = "Dashboard", onOpenQuickAdd }: HeaderProps) {
  const router = useRouter();
  const { preset, setPreset, startDate, endDate, setCustomRange } = useDateFilter();
  const { theme, setTheme, isDark } = useTheme();
  const { success, error } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasWebhook, setHasWebhook] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPreset = (val: string) => {
    setDropdownOpen(false);
    if (val === "custom") {
      setCustomModalOpen(true);
    } else {
      setPreset(val);
    }
  };

  useEffect(() => {
    fetch("/api/sheets/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setHasWebhook(Boolean(data.config?.webhookUrl));
        }
      })
      .catch(() => {});
  }, []);

  const handleSheetSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/sheets/sync");
      const data = await res.json();
      if (data && data.success) {
        const salesCount =
          (data.tabs?.revenues?.inserted || 0) +
          (data.tabs?.revenues?.updated || data.tabs?.revenues?.rows || 0);
        const adsCount = data.tabs?.facebookAds?.imported || data.tabs?.facebookAds?.rows || 0;
        const prodCount = data.tabs?.products?.upserted || data.tabs?.products?.rows || 0;
        success(
          "Google Sheet Synced!",
          `Sales: ${salesCount}, Ads: ${adsCount}, Products: ${prodCount}`
        );
        router.refresh();
      } else {
        error(data?.error || "Google Sheet sync failed");
      }
    } catch {
      error("Failed to connect to Google Sheet");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "custom") {
      setCustomModalOpen(true);
    } else {
      setPreset(val);
    }
  };

  const applyCustomRange = () => {
    if (tempStart && tempEnd) {
      setCustomRange(tempStart, tempEnd);
      setCustomModalOpen(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 h-16 border-b bg-card/80 backdrop-blur-xl px-4 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-lg lg:text-xl tracking-tight">{title}</h1>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground">
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                <span>Offline Mode</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          {/* Date Filter Dropdown with Crystal-Clear Custom Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 bg-secondary/90 hover:bg-secondary border border-border/70 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-all text-foreground active:scale-95"
              aria-label="Select Date Range Filter"
            >
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{PRESET_OPTIONS.find((o) => o.value === preset)?.label || "All Time"}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-1.5 z-50 divide-y divide-slate-800 animate-in fade-in zoom-in-95 duration-150">
                <div className="space-y-0.5">
                  {PRESET_OPTIONS.map((opt) => {
                    const isSelected = preset === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelectPreset(opt.value)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-200 hover:text-white hover:bg-slate-800"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Google Sheet Sync Button */}
          <button
            onClick={handleSheetSync}
            disabled={isSyncing}
            title="Sync live from Google Sheet"
            className="inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-emerald-500" : ""}`} />
            <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync Sheet"}</span>
          </button>

          {/* Sheet Write Status Indicator */}
          {!hasWebhook ? (
            <Link
              href="/sheets"
              title="Google Apps Script Web App is not connected yet. Click to setup."
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/20 transition-all"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Connect Sheet Write</span>
            </Link>
          ) : (
            <span
              title="2-Way Real-Time Write to Google Sheet is Active"
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Sheet Sync Active</span>
            </span>
          )}

          {/* Quick Add Button (Desktop) */}
          <button
            onClick={onOpenQuickAdd}
            className="hidden sm:inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Entry</span>
          </button>

          {/* Theme Switcher for mobile / top header */}
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="lg:hidden p-2 rounded-xl border bg-secondary/50 text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
        </div>
      </header>

      {/* Custom Date Modal */}
      {customModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base mb-1">Select Custom Date Range</h3>
            <p className="text-xs text-muted-foreground mb-4">Choose start and end dates for analytics filtering</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date</label>
                <input
                  type="date"
                  value={tempStart}
                  onChange={(e) => setTempStart(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">End Date</label>
                <input
                  type="date"
                  value={tempEnd}
                  onChange={(e) => setTempEnd(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setCustomModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium border hover:bg-secondary text-muted-foreground"
              >
                Cancel
              </button>
              <button
                onClick={applyCustomRange}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
