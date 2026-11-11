"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDateFilter } from "@/components/providers/DateFilterProvider";
import { formatCurrency } from "@/lib/date-utils";
import { useToast } from "@/components/providers/ToastProvider";
import {
  Layers,
  Search,
  Filter,
  Download,
  Trash2,
  TrendingUp,
  Megaphone,
  Receipt,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
} from "lucide-react";

export default function TransactionsPage() {
  const { startDate, endDate } = useDateFilter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/transactions?page=${page}&limit=25&type=${type}&startDate=${startDate}&endDate=${endDate}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, type, search, startDate, endDate]);

  useEffect(() => {
    fetchTransactions();
    const handleRefresh = () => fetchTransactions();
    window.addEventListener("refresh_data", handleRefresh);
    return () => window.removeEventListener("refresh_data", handleRefresh);
  }, [fetchTransactions]);

  const handleExport = (fmt: "csv" | "xlsx") => {
    window.open(`/api/export?target=all_transactions&format=${fmt}&startDate=${startDate}&endDate=${endDate}`, "_blank");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <span>Centralized Transaction Ledger</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Complete chronological ledger of ad spend, sales revenue, and business expenses
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

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-card/60 backdrop-blur-md p-4 rounded-2xl border">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search all transactions..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Transaction Types</option>
            <option value="ad">Facebook Ads Only</option>
            <option value="revenue">Revenues & Sales Only</option>
            <option value="expense">Other Expenses Only</option>
          </select>
        </div>

        <div className="flex items-center justify-end text-xs text-muted-foreground font-medium px-2">
          <span>{totalCount} total ledger entries</span>
        </div>
      </div>

      {/* Ledger Table */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Loading ledger history...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border bg-card/40 text-xs text-muted-foreground space-y-3">
          <Layers className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="font-semibold text-sm text-foreground">No ledger transactions found</p>
          <p>Add a new transaction or import your data.csv file.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/70 text-muted-foreground border-b uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description / Title</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((tx, idx) => {
                  const isRev = tx.type === "revenue";
                  const isAd = tx.type === "ad";
                  return (
                    <tr key={`${tx.type}-${tx.id}-${idx}`} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isRev
                            ? "bg-emerald-500/10 text-emerald-500"
                            : isAd
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-amber-500/10 text-amber-500"
                        }`}>
                          {isRev ? <TrendingUp className="w-3 h-3" /> : isAd ? <Megaphone className="w-3 h-3" /> : <Receipt className="w-3 h-3" />}
                          <span>{tx.type}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium whitespace-nowrap">{tx.date}</td>
                      <td className="py-3 px-4 font-semibold text-foreground max-w-[220px] truncate">
                        {tx.title}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground max-w-[180px] truncate">
                        {tx.product_name || "--"}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                        isRev ? "text-emerald-500" : isAd ? "text-blue-500" : "text-amber-500"
                      }`}>
                        {isRev ? "+" : "-"}{formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground max-w-[160px] truncate">
                        {tx.notes || "--"}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
            <div>
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border bg-card hover:bg-secondary disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border bg-card hover:bg-secondary disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-base capitalize">{selectedTx.type} Record</h3>
              <button onClick={() => setSelectedTx(null)} className="p-1 text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-semibold">{selectedTx.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Title / Campaign:</span>
                <span className="font-semibold text-right max-w-[200px]">{selectedTx.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Product:</span>
                <span className="font-semibold text-right max-w-[200px]">{selectedTx.product_name || "General"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold text-sm text-foreground">{formatCurrency(selectedTx.amount)}</span>
              </div>
              {selectedTx.customer_email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer Email:</span>
                  <span className="font-mono">{selectedTx.customer_email}</span>
                </div>
              )}
              {selectedTx.payment_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment ID:</span>
                  <span className="font-mono">{selectedTx.payment_id}</span>
                </div>
              )}
              {selectedTx.notes && (
                <div className="pt-2 border-t text-muted-foreground">
                  <span className="font-medium text-foreground block mb-0.5">Notes:</span>
                  <p>{selectedTx.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t flex justify-end">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
