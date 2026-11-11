"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useDateFilter } from "@/components/providers/DateFilterProvider";
import { formatCurrency } from "@/lib/date-utils";
import {
  Megaphone,
  TrendingUp,
  Receipt,
  DollarSign,
  TrendingDown,
  ShoppingBag,
  Target,
  Percent,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  UploadCloud,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
  Table,
  Search,
  Check,
  Copy,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function DashboardPage() {
  const { preset, startDate, endDate, productId } = useDateFilter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [hasWebhook, setHasWebhook] = useState(true);

  useEffect(() => {
    fetch("/api/sheets/config")
      .then((res) => res.json())
      .then((d) => {
        if (d.success) setHasWebhook(Boolean(d.config?.webhookUrl));
      })
      .catch(() => {});
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/dashboard?preset=${preset}&startDate=${startDate}&endDate=${endDate}${
        productId !== "all" ? `&productId=${productId}` : ""
      }`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [preset, startDate, endDate, productId]);

  useEffect(() => {
    fetchDashboardData();

    const handleRefresh = () => fetchDashboardData();
    window.addEventListener("refresh_data", handleRefresh);
    return () => window.removeEventListener("refresh_data", handleRefresh);
  }, [fetchDashboardData]);

  const summary = data?.summary || {
    totalAdSpend: 0,
    totalGrossRevenue: 0,
    totalNetRevenue: 0,
    totalOtherExpenses: 0,
    totalProductCost: 0,
    netProfit: 0,
    totalProducts: 0,
    totalOrders: 0,
    roas: 0,
    avgDailyAdSpend: 0,
    costPerSale: 0,
    currencySymbol: "₹",
  };

  const isNetProfitable = summary.netProfit >= 0;
  const charts = data?.charts || {
    dailySpendAndRevenue: [],
    monthlyComparison: [],
    productRevenue: [],
  };

  // Orders Table State (Google Sheet Live)
  const [orderStatusTab, setOrderStatusTab] = useState<"all" | "received" | "cancelled">("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderProduct, setOrderProduct] = useState("all");
  const [orderSortBy, setOrderSortBy] = useState<"date" | "amount">("date");
  const [orderSortOrder, setOrderSortOrder] = useState<"asc" | "desc">("desc");
  const [orderPage, setOrderPage] = useState(1);
  const [ordersPerPage, setOrdersPerPage] = useState(15);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const allOrders: any[] = data?.orders || [];

  const uniqueProducts = Array.from(
    new Set(allOrders.map((o) => o.product_name).filter(Boolean))
  );

  const receivedCount = allOrders.filter(
    (o) => !o.status || o.status.toLowerCase() === "received"
  ).length;
  const cancelledCount = allOrders.filter(
    (o) => o.status && o.status.toLowerCase().includes("cancelled")
  ).length;

  const filteredOrders = allOrders.filter((item) => {
    if (orderStatusTab === "received") {
      if (item.status && item.status.toLowerCase() !== "received") return false;
    } else if (orderStatusTab === "cancelled") {
      if (!item.status || !item.status.toLowerCase().includes("cancelled")) return false;
    }

    if (orderProduct !== "all" && item.product_name !== orderProduct) {
      return false;
    }

    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      const matchEmail = (item.customer_email || "").toLowerCase().includes(q);
      const matchId = (item.payment_id || "").toLowerCase().includes(q);
      const matchProduct = (item.product_name || "").toLowerCase().includes(q);
      const matchStatus = (item.status || "").toLowerCase().includes(q);
      if (!matchEmail && !matchId && !matchProduct && !matchStatus) return false;
    }

    return true;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (orderSortBy === "amount") {
      return orderSortOrder === "asc" ? a.amount - b.amount : b.amount - a.amount;
    }
    return orderSortOrder === "asc"
      ? (a.date || "").localeCompare(b.date || "")
      : (b.date || "").localeCompare(a.date || "");
  });

  const totalPages = Math.ceil(sortedOrders.length / (ordersPerPage === -1 ? 1 : ordersPerPage)) || 1;
  const paginatedOrders = ordersPerPage === -1
    ? sortedOrders
    : sortedOrders.slice((orderPage - 1) * ordersPerPage, orderPage * ordersPerPage);

  const handleCopyPaymentId = (id: string) => {
    if (!id || id === "--") return;
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportTableCSV = () => {
    const headers = ["Date", "Payment ID", "Product Title", "Customer Email", "Paid (Gross)", "Earned (Net)", "Status"];
    const rows = sortedOrders.map((o) => [
      `"${o.date || ""}"`,
      `"${o.payment_id || ""}"`,
      `"${(o.product_name || "").replace(/"/g, '""')}"`,
      `"${o.customer_email || ""}"`,
      o.amount || 0,
      o.net_amount || 0,
      `"${o.status || "Received"}"`,
    ]);
    const csvStr = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orders_${orderStatusTab}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Webhook Pending Setup Banner */}
      {!hasWebhook && (
        <div className="p-4 sm:p-5 rounded-2xl border bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-orange-950/30 border-amber-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-amber-200">Google Sheet Direct Write Setup Required</h3>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Dashboard live Google Sheet se connected hai. Lekin website se nayi entry (Facebook Ad, Expense, Product) sheet me direct save hone ke liye 1 baar Apps Script Web App URL connect karein.
              </p>
            </div>
          </div>
          <Link
            href="/sheets"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
          >
            <span>Setup Guide (30 Sec) →</span>
          </Link>
        </div>
      )}

      {/* Primary Financial Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Financial Overview</h2>
          <p className="text-xs text-muted-foreground">
            Period: {startDate} to {endDate} &bull; Filter: {preset.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2 rounded-xl border hover:bg-secondary text-muted-foreground hover:text-foreground text-xs flex items-center gap-1.5"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            href="/reports/date-wise"
            className="px-3 py-1.5 rounded-xl border bg-secondary/50 text-xs font-medium hover:bg-secondary flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
            <span>Date-wise Breakdown</span>
          </Link>
        </div>
      </div>

      {/* 10 Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. FB Ads Spend */}
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Meta Ad Spend</span>
            <Megaphone className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold text-foreground">
              {formatCurrency(summary.totalAdSpend)}
            </div>
            <p className="text-[11px] text-muted-foreground">Total paid Facebook Ads</p>
          </div>
        </div>

        {/* 2. Total Gross Revenue */}
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summary.totalGrossRevenue)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Net Earned: {formatCurrency(summary.totalNetRevenue)}
            </p>
          </div>
        </div>

        {/* 3. Other Expenses */}
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Other Expenses</span>
            <Receipt className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold text-foreground">
              {formatCurrency(summary.totalOtherExpenses)}
            </div>
            <p className="text-[11px] text-muted-foreground">Tools, hosting & overheads</p>
          </div>
        </div>

        {/* 4. Net Profit / Loss */}
        <div className={`p-4 rounded-2xl border backdrop-blur-md shadow-sm space-y-2 ${
          isNetProfitable ? "bg-emerald-950/20 border-emerald-900/40" : "bg-rose-950/20 border-rose-900/40"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Net Profit / Loss</span>
            {isNetProfitable ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <div>
            <div className={`text-lg sm:text-xl font-bold ${isNetProfitable ? "text-emerald-500" : "text-rose-500"}`}>
              {formatCurrency(summary.netProfit)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isNetProfitable ? "Profitable period" : "Net negative loss"}
            </p>
          </div>
        </div>

        {/* 5. ROAS */}
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">ROAS</span>
            <Percent className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold text-foreground">
              {summary.roas > 0 ? `${summary.roas}x` : "0.0x"}
            </div>
            <p className="text-[11px] text-muted-foreground">Return on Ad Spend</p>
          </div>
        </div>

        {/* 6. Total Orders & Status Breakdown */}
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Orders Overview</span>
            <ShoppingBag className="w-4 h-4 text-cyan-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
              <span>{summary.totalReceivedOrders ?? summary.totalOrders}</span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                ● Received
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              + {summary.totalCancelledOrders || 0} Cancelled ({formatCurrency(summary.totalCancelledAmount || 0)})
            </p>
          </div>
        </div>

        {/* 7. Total Products */}
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Products</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold text-foreground">
              {summary.totalProducts}
            </div>
            <p className="text-[11px] text-muted-foreground">Catalog items</p>
          </div>
        </div>

        {/* 8. Cost Per Sale (CPA / Ad Spend per Sale) */}
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md shadow-sm space-y-2 hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Cost Per Sale (CPA)</span>
            <Target className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold text-foreground">
              {summary.totalReceivedOrders > 0
                ? formatCurrency(summary.costPerSale)
                : summary.totalAdSpend > 0
                ? "No sales yet"
                : "₹0.00"}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center justify-between mt-0.5">
              <span>1 sale ka ad cost</span>
              {summary.totalReceivedOrders > 0 && (
                <span className="text-[10px] text-amber-500/90 font-mono font-medium">
                  {formatCurrency(summary.totalAdSpend)} ÷ {summary.totalReceivedOrders}
                </span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Avg daily: {formatCurrency(summary.avgDailyAdSpend)}/day
            </p>
          </div>
        </div>

        {/* 9. Product Cost */}
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Product Cost (COGS)</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold text-foreground">
              {formatCurrency(summary.totalProductCost)}
            </div>
            <p className="text-[11px] text-muted-foreground">Base product creation cost</p>
          </div>
        </div>

        {/* 10. Platform Fees & Deductions */}
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Fees & Deductions</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold text-foreground">
              {formatCurrency(summary.totalDeductions + summary.totalRefunds)}
            </div>
            <p className="text-[11px] text-muted-foreground">Gateway GST & platform cuts</p>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Daily Revenue vs Ad Spend & Profit Trend */}
        <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">Daily Revenue & Ad Spend</h3>
              <p className="text-xs text-muted-foreground">Trends over time in the selected date range</p>
            </div>
            <span className="text-[11px] text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium">
              Interactive
            </span>
          </div>

          <div className="h-72 w-full">
            {charts.dailySpendAndRevenue.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No daily data in selected range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.dailySpendAndRevenue}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAds" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "12px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      fontSize: "12px",
                    }}
                    formatter={(val: any) => [`₹${val}`, ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Gross Revenue (₹)"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                  />
                  <Area
                    type="monotone"
                    dataKey="adSpend"
                    name="Ad Spend (₹)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAds)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Daily Profit / Loss Bar Chart */}
        <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">Daily Net Profit / Loss</h3>
              <p className="text-xs text-muted-foreground">Net earnings after Facebook ads & expenses</p>
            </div>
            <span className="text-[11px] text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium">
              Daily Margin
            </span>
          </div>

          <div className="h-72 w-full">
            {charts.dailySpendAndRevenue.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No profit/loss data in selected range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.dailySpendAndRevenue}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "12px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      fontSize: "12px",
                    }}
                    formatter={(val: any) => [`₹${val}`, "Net Profit"]}
                  />
                  <Bar
                    dataKey="profit"
                    name="Net Profit (₹)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Product-wise Revenue & Ad Spend Breakdown */}
        <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">Product-wise Financials</h3>
              <p className="text-xs text-muted-foreground">Revenue and ad spend by digital product</p>
            </div>
            <Link
              href="/reports/product-wise"
              className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
            >
              <span>View Full Report</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-72 w-full">
            {charts.productRevenue.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No product revenue recorded in selected range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.productRevenue} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "12px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      fontSize: "12px",
                    }}
                    formatter={(val: any) => [`₹${val}`, ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Bar dataKey="revenue" name="Revenue (₹)" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="adSpend" name="Ad Spend (₹)" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 4: Monthly Expense vs Revenue Comparison */}
        <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">Monthly Revenue vs Ad Spend</h3>
              <p className="text-xs text-muted-foreground">Aggregated performance by month</p>
            </div>
            <span className="text-[11px] text-muted-foreground bg-secondary px-2.5 py-1 rounded-full font-medium">
              Monthly Rollup
            </span>
          </div>

          <div className="h-72 w-full">
            {charts.monthlyComparison.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No monthly data in selected range
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.monthlyComparison}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "12px",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      fontSize: "12px",
                    }}
                    formatter={(val: any) => [`₹${val}`, ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  <Bar dataKey="revenue" name="Revenue (₹)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="adSpend" name="Ad Spend (₹)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Net Profit (₹)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Complete Customer Orders & Sales Ledger (Google Sheet Live) */}
      <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">Customer Orders & Sales Ledger</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Google Sheet Live
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                All customer transactions synced from sheet with real-time Received and Cancelled status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportTableCSV}
              className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:bg-secondary flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-all active:scale-95"
              title="Download currently filtered orders as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <Link
              href="/revenue"
              className="px-3 py-1.5 rounded-xl border bg-secondary/50 text-xs font-semibold hover:bg-secondary flex items-center gap-1.5 text-foreground transition-all"
            >
              <span>Manage Revenue</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
            </Link>
          </div>
        </div>

        {/* Filter Pills & Search Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-secondary/60 rounded-2xl border shrink-0 overflow-x-auto">
            <button
              onClick={() => { setOrderStatusTab("all"); setOrderPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                orderStatusTab === "all"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>All Orders</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-secondary text-foreground font-mono">
                {allOrders.length}
              </span>
            </button>

            <button
              onClick={() => { setOrderStatusTab("received"); setOrderPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                orderStatusTab === "received"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-emerald-500"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${orderStatusTab === "received" ? "bg-white" : "bg-emerald-500"}`} />
              <span>Received</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                orderStatusTab === "received" ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-500"
              }`}>
                {receivedCount}
              </span>
            </button>

            <button
              onClick={() => { setOrderStatusTab("cancelled"); setOrderPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                orderStatusTab === "cancelled"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-rose-500"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${orderStatusTab === "cancelled" ? "bg-white" : "bg-rose-500"}`} />
              <span>Cancelled by customer</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                orderStatusTab === "cancelled" ? "bg-white/20 text-white" : "bg-rose-500/10 text-rose-500"
              }`}>
                {cancelledCount}
              </span>
            </button>
          </div>

          {/* Search & Selectors */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap grow lg:max-w-xl">
            <div className="relative grow">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search email, payment ID, product..."
                value={orderSearch}
                onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(1); }}
                className="w-full pl-8 pr-3 py-1.5 bg-secondary/70 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {orderSearch && (
                <button
                  onClick={() => setOrderSearch("")}
                  className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={orderProduct}
              onChange={(e) => { setOrderProduct(e.target.value); setOrderPage(1); }}
              className="px-2.5 py-1.5 bg-secondary/70 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary max-w-[160px] truncate"
            >
              <option value="all">All Products</option>
              {uniqueProducts.map((p: any) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              value={ordersPerPage}
              onChange={(e) => { setOrdersPerPage(parseInt(e.target.value)); setOrderPage(1); }}
              className="px-2.5 py-1.5 bg-secondary/70 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="15">15 rows</option>
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
              <option value="-1">All rows</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {sortedOrders.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground rounded-2xl border border-dashed bg-secondary/20">
            No orders match the current filter or search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-background/50">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/70 text-muted-foreground border-b uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Payment ID</th>
                  <th className="py-3 px-4">Product Title</th>
                  <th className="py-3 px-4">Customer Email</th>
                  <th className="py-3 px-4 text-right">Order Amount</th>
                  <th className="py-3 px-4 text-right">Net Earned</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedOrders.map((order: any, idx: number) => {
                  const isReceived = !order.status || order.status.toLowerCase() === "received";
                  const isCancelled = order.status && order.status.toLowerCase().includes("cancelled");
                  return (
                    <tr key={order.id || idx} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4 font-medium whitespace-nowrap text-muted-foreground">
                        {order.date}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          onClick={() => handleCopyPaymentId(order.payment_id)}
                          className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-secondary/80 hover:bg-secondary text-foreground border border-border/60 flex items-center gap-1.5 group"
                          title="Click to copy payment ID"
                        >
                          <span>{order.payment_id || "--"}</span>
                          {copiedId === order.payment_id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3 text-muted-foreground group-hover:text-foreground opacity-60" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 max-w-[240px]">
                        <div className="font-semibold text-foreground truncate" title={order.product_name}>
                          {order.product_name || "Digital Product"}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-[180px]">
                        <span className="text-muted-foreground truncate block" title={order.customer_email}>
                          {order.customer_email || "--"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                        <span className={isCancelled ? "line-through text-muted-foreground/80 font-normal" : "text-foreground"}>
                          {formatCurrency(order.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                        {isReceived ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(order.net_amount || order.amount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-normal text-[11px]">
                            ₹0.00
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isReceived ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Received</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Cancelled by customer</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {ordersPerPage !== -1 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
            <div>
              Showing {Math.min((orderPage - 1) * ordersPerPage + 1, sortedOrders.length)} to{" "}
              {Math.min(orderPage * ordersPerPage, sortedOrders.length)} of {sortedOrders.length} orders
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                disabled={orderPage === 1}
                className="px-2.5 py-1 rounded-lg border bg-secondary/40 hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="px-3 py-1 font-semibold text-foreground">
                Page {orderPage} of {totalPages}
              </span>
              <button
                onClick={() => setOrderPage((p) => Math.min(totalPages, p + 1))}
                disabled={orderPage === totalPages}
                className="px-2.5 py-1 rounded-lg border bg-secondary/40 hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Combined Ads & Overhead Expenses Ledger */}
      <div className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">Meta Ads & Overheads Activity</h3>
            <p className="text-xs text-muted-foreground">Recent advertising investments and operating expenses</p>
          </div>
          <Link
            href="/transactions"
            className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
          >
            <span>View All Activity</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {(!data?.recentTransactions || data.recentTransactions.length === 0) ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No transactions found.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {data.recentTransactions.map((tx: any, idx: number) => {
              const isRevenue = tx.type === "revenue";
              const isAd = tx.type === "ad";
              return (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isRevenue
                        ? "bg-emerald-500/10 text-emerald-500"
                        : isAd
                        ? "bg-blue-500/10 text-blue-500"
                        : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {isRevenue ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : isAd ? (
                        <Megaphone className="w-4 h-4" />
                      ) : (
                        <Receipt className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate leading-tight">{tx.title || "Transaction"}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {tx.date} &bull; {tx.product_name || "General"} {tx.status ? `• ${tx.status}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${
                      isRevenue ? "text-emerald-500" : isAd ? "text-blue-500" : "text-amber-500"
                    }`}>
                      {isRevenue ? "+" : "-"}{formatCurrency(tx.amount)}
                    </div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      {tx.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
