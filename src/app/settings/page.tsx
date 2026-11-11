"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useDateFilter } from "@/components/providers/DateFilterProvider";
import { useToast } from "@/components/providers/ToastProvider";
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  Calendar,
  DollarSign,
  HardDrive,
  Smartphone,
  Save,
  CheckCircle2,
  Database,
} from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { preset, setPreset } = useDateFilter();
  const { success } = useToast();

  const [currency, setCurrency] = useState("INR");
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running as PWA
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsStandalone(true);
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallPWA = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsStandalone(true);
      }
      setInstallPrompt(null);
    }
  };

  const handleSaveSettings = () => {
    success("Settings Updated", "Preferences saved successfully.");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="pb-2 border-b">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <span>Application Settings</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure preferences, display settings, and view local environment status
        </p>
      </div>

      {/* Theme Preferences */}
      <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md space-y-3">
        <h3 className="font-bold text-sm">Theme Appearance</h3>
        <p className="text-xs text-muted-foreground">Select your interface color scheme</p>

        <div className="grid grid-cols-3 gap-3 pt-1">
          <button
            onClick={() => setTheme("dark")}
            className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
              theme === "dark" ? "border-primary bg-primary/10 text-primary" : "hover:bg-secondary/60 text-muted-foreground"
            }`}
          >
            <Moon className="w-5 h-5" />
            <span>Dark Theme</span>
          </button>

          <button
            onClick={() => setTheme("light")}
            className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
              theme === "light" ? "border-primary bg-primary/10 text-primary" : "hover:bg-secondary/60 text-muted-foreground"
            }`}
          >
            <Sun className="w-5 h-5" />
            <span>Light Theme</span>
          </button>

          <button
            onClick={() => setTheme("system")}
            className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
              theme === "system" ? "border-primary bg-primary/10 text-primary" : "hover:bg-secondary/60 text-muted-foreground"
            }`}
          >
            <Monitor className="w-5 h-5" />
            <span>System Default</span>
          </button>
        </div>
      </div>

      {/* Default Filter Preset */}
      <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md space-y-3">
        <h3 className="font-bold text-sm">Default Analytics Period</h3>
        <p className="text-xs text-muted-foreground">Sets the default date window applied on app launch</p>

        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="w-full sm:w-72 px-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last_7_days">Last 7 Days</option>
          <option value="last_30_days">Last 30 Days (Recommended)</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="this_year">This Year</option>
          <option value="all_time">All Time</option>
        </select>
      </div>

      {/* Currency Display */}
      <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md space-y-3">
        <h3 className="font-bold text-sm">Currency Settings</h3>
        <p className="text-xs text-muted-foreground">Default monetary currency symbol for financial reporting</p>

        <div className="flex items-center gap-3">
          <input
            type="text"
            readOnly
            value="INR (₹ Indian Rupee)"
            className="w-full sm:w-72 px-3 py-2 bg-secondary border rounded-xl text-xs font-semibold text-foreground cursor-not-allowed"
          />
        </div>
      </div>

      {/* Database & Environment Info */}
      <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-500" />
          <span>Local SQLite Connection</span>
        </h3>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Database Path:</span>
            <span className="font-mono text-foreground font-medium">./expense.db</span>
          </div>
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Sample CSV Source:</span>
            <span className="font-mono text-foreground font-medium">./data.csv</span>
          </div>
          <div className="flex justify-between py-1 border-b">
            <span className="text-muted-foreground">Storage Engine:</span>
            <span className="font-medium text-foreground">SQLite WAL Mode (Node Sync)</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Authentication:</span>
            <span className="font-medium text-emerald-500">Disabled (Personal App Mode)</span>
          </div>
        </div>
      </div>

      {/* PWA App Installation Status */}
      <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary" />
          <span>Progressive Web App (PWA)</span>
        </h3>
        <p className="text-xs text-muted-foreground">
          Install AdSpend Pro on your phone or desktop to use it like a native application with offline shell support.
        </p>

        {isStandalone ? (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Running in Standalone PWA Mode</span>
          </div>
        ) : (
          <button
            onClick={handleInstallPWA}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary border hover:bg-secondary/70 flex items-center gap-2"
          >
            <Smartphone className="w-4 h-4" />
            <span>Install on Home Screen / Desktop</span>
          </button>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveSettings}
          className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Save Preferences</span>
        </button>
      </div>
    </div>
  );
}
