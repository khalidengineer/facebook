"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDateFilter } from "@/components/providers/DateFilterProvider";
import { formatCurrency } from "@/lib/date-utils";
import {
  PieChart,
  Download,
  Award,
  TrendingDown,
  AlertTriangle,
  Megaphone,
  TrendingUp,
  Percent,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";

export default function ProductWiseReportPage() {
  const { preset, startDate, endDate } = useDateFilter();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any>(null);
  const [totals, setTotals] = useState<any>(null);

  const fetchProductReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/product-wise?preset=${preset}&startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();
      if (data.success) {
        setReport(data.report || []);
        setHighlights(data.highlights || null);
        setTotals(data.totals || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [preset, startDate, endDate]);

  useEffect(() => {
    fetchProductReport();
    const handleRefresh = () => fetchProductReport();
    window.addEventListener("refresh_data", handleRefresh);
    return () => window.removeEventListener("refresh_data", handleRefresh);
  }, [fetchProductReport]);

  const handleExport = (fmt: "csv" | "xlsx") => {
    window.open(`/api/export?target=product_report&format=${fmt}&startDate=${startDate}&endDate=${endDate}`, "_blank");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-500" />
            <span>Product Profit & Loss Statement</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Product-level unit economics, ROAS attribution, and net profit margins
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleExport("csv")}
            className="px-3 py-1.5 rounded-xl border text-xs font-medium hover:bg-secondary flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={() => handleExport("xlsx")}
            className="px-3 py-1.5 rounded-xl border text-xs font-medium hover:bg-secondary flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Highlights Cards */}
      {highlights && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Best Performing */}
          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Most Profitable Product</span>
              <Award className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="font-bold text-sm text-foreground truncate">
              {highlights.bestPerforming?.productName || "None"}
            </div>
            <div className="text-xs text-emerald-500 font-semibold">
              Net Profit: {formatCurrency(highlights.bestPerforming?.netProfit || 0)}
            </div>
          </div>

          {/* Highest Ad Spend */}
          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Highest Ad Spend</span>
              <Megaphone className="w-4 h-4 text-blue-500" />
            </div>
            <div className="font-bold text-sm text-foreground truncate">
              {highlights.highestAdSpend?.productName || "None"}
            </div>
            <div className="text-xs text-blue-500 font-semibold">
              Ad Investment: {formatCurrency(highlights.highestAdSpend?.adSpend || 0)}
            </div>
          </div>

          {/* Highest ROAS */}
          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Highest ROAS</span>
              <Percent className="w-4 h-4 text-purple-500" />
            </div>
            <div className="font-bold text-sm text-foreground truncate">
              {highlights.mostProfitable?.productName || "None"}
            </div>
            <div className="text-xs text-purple-500 font-semibold">
              Multiplier: {highlights.mostProfitable?.roas || 0}x
            </div>
          </div>

          {/* Loss Making Products */}
          <div className={`p-4 rounded-2xl border backdrop-blur-md space-y-1.5 ${
            highlights.lossMakingCount > 0 ? "bg-rose-950/20 border-rose-900/40" : "bg-card/60"
          }`}>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">Loss-Making Products</span>
              <AlertTriangle className={`w-4 h-4 ${highlights.lossMakingCount > 0 ? "text-rose-500" : "text-slate-400"}`} />
            </div>
            <div className="font-bold text-sm text-foreground">
              {highlights.lossMakingCount} Products at a loss
            </div>
            <div className="text-xs text-muted-foreground">
              {highlights.lossMakingCount > 0 ? "Ad spend exceeds net revenue" : "All active products profitable"}
            </div>
          </div>
        </div>
      )}

      {/* Product Performance Table */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Calculating product unit economics...</span>
        </div>
      ) : report.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border bg-card/40 text-xs text-muted-foreground space-y-3">
          <Layers className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="font-semibold text-sm text-foreground">No product performance data</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/70 text-muted-foreground border-b uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Product</th>
                <th className="py-3.5 px-4 text-center">Orders</th>
                <th className="py-3.5 px-4 text-right">Revenue (Gross)</th>
                <th className="py-3.5 px-4 text-right">Revenue (Net)</th>
                <th className="py-3.5 px-4 text-right">FB Ad Spend</th>
                <th className="py-3.5 px-4 text-right">Product Cost</th>
                <th className="py-3.5 px-4 text-right">Other Expenses</th>
                <th className="py-3.5 px-4 text-right">Net Profit</th>
                <th className="py-3.5 px-4 text-center">ROAS</th>
                <th className="py-3.5 px-4 text-center">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.map((item) => {
                const isProfitable = item.netProfit >= 0;
                return (
                  <tr key={item.productId} className="hover:bg-secondary/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-foreground max-w-[240px]">
                      <div className="truncate">{item.productName}</div>
                      <span className="text-[10px] text-muted-foreground font-normal">{item.category}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-foreground">
                      {item.orders}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-foreground whitespace-nowrap">
                      {formatCurrency(item.revenue)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-emerald-500 whitespace-nowrap">
                      {formatCurrency(item.netRevenue)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-blue-500 whitespace-nowrap">
                      {formatCurrency(item.adSpend)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-muted-foreground whitespace-nowrap">
                      {formatCurrency(item.productCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-amber-500 whitespace-nowrap">
                      {formatCurrency(item.otherExpenses)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className={`font-bold inline-flex items-center gap-1 ${
                        isProfitable ? "text-emerald-500" : "text-rose-500"
                      }`}>
                        {isProfitable ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {formatCurrency(item.netProfit)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap font-bold text-purple-500">
                      {item.roas > 0 ? `${item.roas}x` : "--"}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.marginPercent >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                      }`}>
                        {item.marginPercent}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totals && (
              <tfoot className="bg-secondary/70 font-bold border-t">
                <tr>
                  <td className="py-3.5 px-4 uppercase text-[11px] text-muted-foreground">Totals:</td>
                  <td></td>
                  <td className="py-3.5 px-4 text-right text-foreground">{formatCurrency(totals.totalRevenue)}</td>
                  <td></td>
                  <td className="py-3.5 px-4 text-right text-blue-500">{formatCurrency(totals.totalAdSpend)}</td>
                  <td colSpan={2}></td>
                  <td className={`py-3.5 px-4 text-right font-bold ${
                    totals.totalProfit >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}>
                    {formatCurrency(totals.totalProfit)}
                  </td>
                  <td className="py-3.5 px-4 text-center text-purple-500">{totals.overallROAS}x</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
