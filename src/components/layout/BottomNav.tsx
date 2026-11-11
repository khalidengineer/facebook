"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Package,
  Receipt,
  FileSpreadsheet,
  MoreHorizontal,
  TrendingUp,
  PieChart,
  Calendar,
  Layers,
  UploadCloud,
  DatabaseBackup,
  Settings,
  X,
  Plus,
  Table,
} from "lucide-react";

interface BottomNavProps {
  onOpenQuickAdd: () => void;
}

export function BottomNav({ onOpenQuickAdd }: BottomNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const mainTabs = [
    { name: "Home", href: "/", icon: LayoutDashboard },
    { name: "Ads", href: "/ads", icon: Megaphone },
    { name: "Products", href: "/products", icon: Package },
    { name: "Expenses", href: "/expenses", icon: Receipt },
    { name: "Reports", href: "/reports/date-wise", icon: FileSpreadsheet },
  ];

  const secondaryTabs = [
    { name: "Revenue / Sales", href: "/revenue", icon: TrendingUp, desc: "Manual income & Cosmofeed logs" },
    { name: "Product Profit/Loss", href: "/reports/product-wise", icon: PieChart, desc: "Product-wise financial analytics" },
    { name: "Monthly Calendar", href: "/calendar", icon: Calendar, desc: "Calendar view of daily profit/loss" },
    { name: "Transactions Ledger", href: "/transactions", icon: Layers, desc: "Complete centralized history" },
    { name: "CSV Import", href: "/import", icon: UploadCloud, desc: "Cosmofeed & FB Ads CSV upload" },
    { name: "Backup & Restore", href: "/backup", icon: DatabaseBackup, desc: "SQLite database & CSV backups" },
    { name: "App Settings", href: "/settings", icon: Settings, desc: "Currency, themes & defaults" },
  ];

  return (
    <>
      {/* Floating Action Button (Mobile Only) */}
      <div className="lg:hidden fixed bottom-20 right-5 z-40">
        <button
          onClick={onOpenQuickAdd}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 flex items-center justify-center active:scale-95 transition-transform border-2 border-white/20"
          aria-label="Add transaction"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Fixed Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur-xl pb-safe">
        <div className="flex items-center justify-around h-16 px-1">
          {mainTabs.map((tab) => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center w-full h-full py-1 transition-all ${
                  isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 ${isActive ? "text-primary stroke-[2.2]" : ""}`} />
                <span className="text-[10px] tracking-tight">{tab.name}</span>
              </Link>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center w-full h-full py-1 transition-all ${
              moreOpen ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MoreHorizontal className="w-5 h-5 mb-1" />
            <span className="text-[10px] tracking-tight">More</span>
          </button>
        </div>
      </nav>

      {/* More Slide-over / Modal for Mobile */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-card border-t rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <h3 className="font-bold text-lg">More Tools & Reports</h3>
                <p className="text-xs text-muted-foreground">Additional features and settings</p>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-2 rounded-full hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-3 space-y-2">
              {secondaryTabs.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3.5 p-3 rounded-2xl transition-all ${
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary/70 border border-transparent hover:border-border"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl ${isActive ? "bg-white/20 text-white" : "bg-primary/10 text-primary"}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{item.name}</p>
                      <p className={`text-xs mt-0.5 ${isActive ? "text-white/80" : "text-muted-foreground"}`}>
                        {item.desc}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
