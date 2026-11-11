"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Package,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  PieChart,
  Calendar,
  Layers,
  UploadCloud,
  DatabaseBackup,
  Settings,
  Sparkles,
  Sun,
  Moon,
  Table,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Facebook Ads", href: "/ads", icon: Megaphone },
  { name: "Products", href: "/products", icon: Package },
  { name: "Revenue", href: "/revenue", icon: TrendingUp },
  { name: "Other Expenses", href: "/expenses", icon: Receipt },
  { name: "Date Reports", href: "/reports/date-wise", icon: FileSpreadsheet },
  { name: "Product Reports", href: "/reports/product-wise", icon: PieChart },
  { name: "Calendar View", href: "/calendar", icon: Calendar },
  { name: "Transactions", href: "/transactions", icon: Layers },
  { name: "CSV Import", href: "/import", icon: UploadCloud, badge: "Important" },
  { name: "Backup & Restore", href: "/backup", icon: DatabaseBackup },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme, isDark } = useTheme();

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r bg-card/60 backdrop-blur-xl shrink-0 h-screen sticky top-0 select-none z-30">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-base tracking-tight block leading-tight">AdSpend Pro</span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Meta & Profit PWA</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                  isActive ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Theme Switch */}
      <div className="p-4 border-t flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-muted-foreground font-medium">Google Sheet Live</span>
        </div>
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="p-2 rounded-lg border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>
    </aside>
  );
}
