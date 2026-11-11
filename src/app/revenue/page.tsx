"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDateFilter } from "@/components/providers/DateFilterProvider";
import { formatCurrency } from "@/lib/date-utils";
import { useToast } from "@/components/providers/ToastProvider";
import {
  TrendingUp,
  Search,
  Filter,
  Download,
  Trash2,
  Edit2,
  Layers,
  ShoppingBag,
  Loader2,
  X,
  Check,
} from "lucide-react";

export default function RevenuePage() {
  const { startDate, endDate } = useDateFilter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [revenues, setRevenues] = useState<any[]>([]);
  const [totalGross, setTotalGross] = useState(0);
  const [totalNet, setTotalNet] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalReceivedOrders, setTotalReceivedOrders] = useState(0);
  const [totalCancelledOrders, setTotalCancelledOrders] = useState(0);
  const [totalCancelledAmount, setTotalCancelledAmount] = useState(0);
  const [products, setProducts] = useState<any[]>([]);

  // Search & Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Edit / Delete Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const fetchRevenues = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/revenues?startDate=${startDate}&endDate=${endDate}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (statusFilter !== "all") url += `&status=${encodeURIComponent(statusFilter)}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedProduct !== "all") url += `&productId=${encodeURIComponent(selectedProduct)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRevenues(data.revenues || []);
        setTotalGross(data.totalGross || 0);
        setTotalNet(data.totalNet || 0);
        setTotalOrders(data.totalOrders || 0);
        setTotalReceivedOrders(data.totalReceivedOrders || 0);
        setTotalCancelledOrders(data.totalCancelledOrders || 0);
        setTotalCancelledAmount(data.totalCancelledAmount || 0);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, sortBy, sortOrder, search, selectedProduct, statusFilter]);

  useEffect(() => {
    fetchRevenues();
    fetch("/api/products")
      .then((res) => res.json())
      .then((d) => {
        if (d.products) setProducts(d.products);
      })
      .catch(console.error);

    const handleRefresh = () => fetchRevenues();
    window.addEventListener("refresh_data", handleRefresh);
    return () => window.removeEventListener("refresh_data", handleRefresh);
  }, [fetchRevenues]);

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/revenues/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        success("Revenue Deleted", "Record removed from database");
        setDeleteConfirmId(null);
        fetchRevenues();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      error("Delete Failed", err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRevenue) return;
    try {
      const res = await fetch(`/api/revenues/${editingRevenue.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingRevenue),
      });
      const data = await res.json();
      if (data.success) {
        success("Revenue Updated", `Saved updates to sale record`);
        setEditModalOpen(false);
        setEditingRevenue(null);
        fetchRevenues();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      error("Update Failed", err.message);
    }
  };

  const handleExport = (fmt: "csv" | "xlsx") => {
    window.open(`/api/export?target=revenues&format=${fmt}&startDate=${startDate}&endDate=${endDate}`, "_blank");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <span>Revenue & Income Management</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Customer sales records, Cosmofeed imports, and manual revenue logs
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md">
          <span className="text-xs text-muted-foreground block">Gross Revenue (Received)</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalGross)}
          </span>
        </div>
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md">
          <span className="text-xs text-muted-foreground block">Net Earned (Payout)</span>
          <span className="text-2xl font-bold text-foreground">
            {formatCurrency(totalNet)}
          </span>
        </div>
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md">
          <span className="text-xs text-muted-foreground block">Received Orders</span>
          <span className="text-2xl font-bold text-emerald-500">
            {totalReceivedOrders}
          </span>
        </div>
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md">
          <span className="text-xs text-muted-foreground block">Cancelled by Customer</span>
          <span className="text-2xl font-bold text-rose-500">
            {totalCancelledOrders}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">
            Lost: {formatCurrency(totalCancelledAmount)}
          </span>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-secondary/60 rounded-2xl border shrink-0 overflow-x-auto w-fit">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            statusFilter === "all"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>All Orders</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-secondary text-foreground font-mono">
            {totalOrders}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter("Received")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            statusFilter.toLowerCase() === "received"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-emerald-500"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${statusFilter.toLowerCase() === "received" ? "bg-white" : "bg-emerald-500"}`} />
          <span>Received</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            statusFilter.toLowerCase() === "received" ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-500"
          }`}>
            {totalReceivedOrders}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter("Cancelled by customer")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            statusFilter.toLowerCase().includes("cancelled")
              ? "bg-rose-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-rose-500"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${statusFilter.toLowerCase().includes("cancelled") ? "bg-white" : "bg-rose-500"}`} />
          <span>Cancelled by customer</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            statusFilter.toLowerCase().includes("cancelled") ? "bg-white/20 text-white" : "bg-rose-500/10 text-rose-500"
          }`}>
            {totalCancelledOrders}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-card/60 backdrop-blur-md p-4 rounded-2xl border">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products, emails, IDs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="w-full px-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Gross Amount</option>
            <option value="net_amount">Sort by Net Earned</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="px-3 py-2 bg-secondary/80 border rounded-xl text-xs font-semibold hover:bg-secondary"
            title="Toggle Sort Order"
          >
            {sortOrder.toUpperCase()}
          </button>
        </div>
      </div>

      {/* Revenues Table */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Loading revenue records...</span>
        </div>
      ) : revenues.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border bg-card/40 text-xs text-muted-foreground space-y-3">
          <TrendingUp className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="font-semibold text-sm text-foreground">No revenue transactions found</p>
          <p>Import Cosmofeed data or click &quot;Add Entry&quot; to log manual sales.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card/60 backdrop-blur-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-muted-foreground border-b uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Product Title</th>
                <th className="py-3 px-4">Customer / ID</th>
                <th className="py-3 px-4 text-right">Paid (Gross)</th>
                <th className="py-3 px-4 text-right">Earned (Net)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {revenues.map((item) => {
                const isReceived = !item.status || item.status.toLowerCase() === "received";
                return (
                  <tr key={item.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="py-3 px-4 font-medium whitespace-nowrap">{item.date}</td>
                    <td className="py-3 px-4 max-w-[240px]">
                      <div className="font-semibold text-foreground truncate">{item.product_name}</div>
                      {item.campaign_name && (
                        <span className="text-[10px] text-muted-foreground truncate block">
                          Camp: {item.campaign_name}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-[180px]">
                      <div className="truncate">{item.customer_email || "--"}</div>
                      {item.payment_id && (
                        <span className="text-[10px] text-muted-foreground font-mono truncate block">
                          {item.payment_id}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                      <span className={!isReceived ? "line-through text-muted-foreground/80 font-normal" : "text-foreground"}>
                        {formatCurrency(item.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                      {isReceived ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(item.net_amount || item.amount)}
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
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-foreground uppercase tracking-wider">
                        {item.source || "manual"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditingRevenue(item);
                          setEditModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                        title="Edit revenue"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500"
                        title="Delete revenue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
            <tfoot className="bg-secondary/50 font-bold border-t">
              <tr>
                <td colSpan={3} className="py-3 px-4 text-right uppercase text-[11px] text-muted-foreground">
                  Total Received Revenue:
                </td>
                <td className="py-3 px-4 text-right text-sm text-foreground">
                  {formatCurrency(totalGross)}
                </td>
                <td className="py-3 px-4 text-right text-sm text-emerald-500">
                  {formatCurrency(totalNet)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && editingRevenue && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <h3 className="font-bold text-base">Edit Revenue Entry</h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={editingRevenue.date}
                  onChange={(e) => setEditingRevenue({ ...editingRevenue, date: e.target.value })}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={editingRevenue.product_name}
                  onChange={(e) => setEditingRevenue({ ...editingRevenue, product_name: e.target.value })}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Customer Paid (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingRevenue.amount}
                    onChange={(e) => setEditingRevenue({ ...editingRevenue, amount: e.target.value })}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Net Earned (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRevenue.net_amount || editingRevenue.amount}
                    onChange={(e) => setEditingRevenue({ ...editingRevenue, net_amount: e.target.value })}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm font-bold text-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Campaign (Optional)</label>
                <input
                  type="text"
                  value={editingRevenue.campaign_name || ""}
                  onChange={(e) => setEditingRevenue({ ...editingRevenue, campaign_name: e.target.value })}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <input
                  type="text"
                  value={editingRevenue.notes || ""}
                  onChange={(e) => setEditingRevenue({ ...editingRevenue, notes: e.target.value })}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-base text-rose-500">Confirm Deletion</h3>
            <p className="text-xs text-muted-foreground mt-2">
              Are you sure you want to permanently delete this revenue entry?
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium border"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
