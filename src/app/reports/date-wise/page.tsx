"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDateFilter } from "@/components/providers/DateFilterProvider";
import { formatCurrency } from "@/lib/date-utils";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Megaphone,
  Receipt,
  Loader2,
  X,
} from "lucide-react";

export default function DateWiseReportPage() {
  const { preset, startDate, endDate, productId } = useDateFilter();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);

  // Drilldown date detail
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateDetails, setDateDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/reports/date-wise?preset=${preset}&startDate=${startDate}&endDate=${endDate}`;
      if (productId !== "all") url += `&productId=${productId}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setReport(data.report || []);
        setTotals(data.totals || null);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [preset, startDate, endDate, productId]);

  useEffect(() => {
    fetchReport();
    const handleRefresh = () => fetchReport();
    window.addEventListener("refresh_data", handleRefresh);
    return () => window.removeEventListener("refresh_data", handleRefresh);
  }, [fetchReport]);

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

  const handleExport = (fmt: "csv" | "xlsx") => {
    window.open(`/api/export?target=date_report&format=${fmt}&startDate=${startDate}&endDate=${endDate}`, "_blank");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            <span>Date-wise Financial Statement</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Complete daily accounting of Facebook Ads spend, revenue, costs, and actual net profit/loss
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

      {/* Totals Summary Banner */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-md">
            <span className="text-[11px] text-muted-foreground block">Meta Ad Spend</span>
            <span className="text-base font-bold text-blue-500">{formatCurrency(totals.totalAdSpend)}</span>
          </div>
          <div className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-md">
            <span className="text-[11px] text-muted-foreground block">Gross Revenue</span>
            <span className="text-base font-bold text-foreground">{formatCurrency(totals.totalRevenue)}</span>
          </div>
          <div className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-md">
            <span className="text-[11px] text-muted-foreground block">Net Earned</span>
            <span className="text-base font-bold text-emerald-500">{formatCurrency(totals.totalNetRevenue)}</span>
          </div>
          <div className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-md">
            <span className="text-[11px] text-muted-foreground block">Other Expenses</span>
            <span className="text-base font-bold text-amber-500">{formatCurrency(totals.totalOtherExpenses)}</span>
          </div>
          <div className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-md">
            <span className="text-[11px] text-muted-foreground block">Net Profit / Loss</span>
            <span className={`text-base font-bold ${totals.totalProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {formatCurrency(totals.totalProfit)}
            </span>
          </div>
          <div className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-md">
            <span className="text-[11px] text-muted-foreground block">Overall ROAS</span>
            <span className="text-base font-bold text-purple-500">{totals.overallROAS}x</span>
          </div>
          <div className="p-3.5 rounded-2xl border bg-card/60 backdrop-blur-md">
            <span className="text-[11px] text-muted-foreground block">Cost / Sale (CPA)</span>
            <span className="text-base font-bold text-amber-500">
              {totals.overallCostPerSale > 0 ? formatCurrency(totals.overallCostPerSale) : "--"}
            </span>
          </div>
        </div>
      )}

      {/* Main Date-wise Statement Table */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Generating date-wise report...</span>
        </div>
      ) : report.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border bg-card/40 text-xs text-muted-foreground space-y-3">
          <Calendar className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="font-semibold text-sm text-foreground">No financial activity recorded in this period</p>
          <p>Change your date filter above or import your Cosmofeed transactions.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/70 text-muted-foreground border-b uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 text-right">Facebook Ads (₹)</th>
                <th className="py-3.5 px-4 text-center">Sales</th>
                <th className="py-3.5 px-4 text-right">Cost / Sale (₹)</th>
                <th className="py-3.5 px-4 text-right">Gross Revenue (₹)</th>
                <th className="py-3.5 px-4 text-right">Net Revenue (₹)</th>
                <th className="py-3.5 px-4 text-right">Other Expenses (₹)</th>
                <th className="py-3.5 px-4 text-right">Product Cost (₹)</th>
                <th className="py-3.5 px-4 text-right">Net Profit / Loss</th>
                <th className="py-3.5 px-4 text-center">ROAS</th>
                <th className="py-3.5 px-4 text-center">Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.map((row) => {
                const isProfit = row.profit >= 0;
                return (
                  <tr
                    key={row.date}
                    onClick={() => openDateDetail(row.date)}
                    className="hover:bg-secondary/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-semibold text-foreground whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-blue-500 whitespace-nowrap">
                      {row.adSpend > 0 ? formatCurrency(row.adSpend) : "--"}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-foreground">
                      {row.orders > 0 ? row.orders : "--"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-amber-500 whitespace-nowrap">
                      {row.costPerSale > 0 ? formatCurrency(row.costPerSale) : row.orders === 0 && row.adSpend > 0 ? "No sales" : "--"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-foreground whitespace-nowrap">
                      {row.revenue > 0 ? formatCurrency(row.revenue) : "--"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-emerald-500 whitespace-nowrap">
                      {row.netRevenue > 0 ? formatCurrency(row.netRevenue) : "--"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-amber-500 whitespace-nowrap">
                      {row.otherExpenses > 0 ? formatCurrency(row.otherExpenses) : "--"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-muted-foreground whitespace-nowrap">
                      {row.productCost > 0 ? formatCurrency(row.productCost) : "--"}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className={`font-bold inline-flex items-center gap-1 ${
                        isProfit ? "text-emerald-500" : "text-rose-500"
                      }`}>
                        {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {formatCurrency(row.profit)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-purple-500">
                      {row.roas > 0 ? `${row.roas}x` : "--"}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button className="p-1 rounded-lg bg-secondary/80 group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground transition-colors text-[10px] font-semibold px-2 py-1">
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totals && (
              <tfoot className="bg-secondary/70 font-bold border-t">
                <tr>
                  <td className="py-3.5 px-4 text-left uppercase text-[11px] text-muted-foreground">
                    Totals:
                  </td>
                  <td className="py-3.5 px-4 text-right text-blue-500">
                    {formatCurrency(totals.totalAdSpend)}
                  </td>
                  <td className="py-3.5 px-4 text-center text-foreground font-bold">
                    {totals.totalOrders || 0}
                  </td>
                  <td className="py-3.5 px-4 text-right text-amber-500 font-bold">
                    {totals.overallCostPerSale > 0 ? formatCurrency(totals.overallCostPerSale) : "--"}
                  </td>
                  <td className="py-3.5 px-4 text-right text-foreground">
                    {formatCurrency(totals.totalRevenue)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-500">
                    {formatCurrency(totals.totalNetRevenue)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-amber-500">
                    {formatCurrency(totals.totalOtherExpenses)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-muted-foreground">
                    {formatCurrency(totals.totalProductCost)}
                  </td>
                  <td className={`py-3.5 px-4 text-right font-bold ${
                    totals.totalProfit >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}>
                    {formatCurrency(totals.totalProfit)}
                  </td>
                  <td className="py-3.5 px-4 text-center text-purple-500">
                    {totals.overallROAS}x
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Date Drilldown Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div>
                <h3 className="font-bold text-base">Date Transactions Breakdown</h3>
                <p className="text-xs text-muted-foreground">Detailed audit trail for {selectedDate}</p>
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
              <div className="space-y-5 text-xs">
                {/* Day Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-secondary/50 border">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Ad Investment</span>
                    <span className="font-bold text-blue-500">{formatCurrency(dateDetails.summary.totalAds)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Total Sales</span>
                    <span className="font-bold text-foreground">{dateDetails.summary.totalOrders || 0} Orders</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Cost / Sale (1 sale ka)</span>
                    <span className="font-bold text-amber-500">
                      {dateDetails.summary.costPerSale > 0
                        ? formatCurrency(dateDetails.summary.costPerSale)
                        : (dateDetails.summary.totalOrders === 0 && dateDetails.summary.totalAds > 0 ? "No sales" : "--")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Net Profit</span>
                    <span className={`font-bold ${dateDetails.summary.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {formatCurrency(dateDetails.summary.netProfit)}
                    </span>
                  </div>
                </div>

                {/* Section 1: Facebook Ads */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Megaphone className="w-3.5 h-3.5 text-blue-500" />
                    <span>Facebook Ads ({dateDetails.ads.length})</span>
                  </h4>
                  {dateDetails.ads.length === 0 ? (
                    <p className="text-muted-foreground italic">No Facebook ad spend logged for this date.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {dateDetails.ads.map((a: any) => (
                        <div key={a.id} className="p-2.5 rounded-xl border bg-secondary/30 flex justify-between items-center">
                          <div>
                            <span className="font-semibold block text-foreground">{a.campaign_name}</span>
                            <span className="text-[10px] text-muted-foreground">{a.product_name || "General"}</span>
                          </div>
                          <span className="font-bold text-blue-500">{formatCurrency(a.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 2: Revenues / Sales */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Sales & Revenues ({dateDetails.revenues.length})</span>
                  </h4>
                  {dateDetails.revenues.length === 0 ? (
                    <p className="text-muted-foreground italic">No sales revenue recorded for this date.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {dateDetails.revenues.map((r: any) => (
                        <div key={r.id} className="p-2.5 rounded-xl border bg-secondary/30 flex justify-between items-center">
                          <div>
                            <span className="font-semibold block text-foreground">{r.product_name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {r.customer_email || r.payment_id || "Direct"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-500 block">
                              {formatCurrency(r.net_amount || r.amount)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">Gross: {formatCurrency(r.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 3: Other Expenses */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-amber-500" />
                    <span>Other Expenses ({dateDetails.otherExpenses.length})</span>
                  </h4>
                  {dateDetails.otherExpenses.length === 0 ? (
                    <p className="text-muted-foreground italic">No other expenses on this date.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {dateDetails.otherExpenses.map((e: any) => (
                        <div key={e.id} className="p-2.5 rounded-xl border bg-secondary/30 flex justify-between items-center">
                          <div>
                            <span className="font-semibold block text-foreground">{e.description}</span>
                            <span className="text-[10px] text-muted-foreground">{e.category}</span>
                          </div>
                          <span className="font-bold text-amber-500">{formatCurrency(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
                  >
                    Close
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
