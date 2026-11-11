"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDateFilter } from "@/components/providers/DateFilterProvider";
import { formatCurrency } from "@/lib/date-utils";
import { useToast } from "@/components/providers/ToastProvider";
import {
  Megaphone,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Download,
  Calendar,
  Layers,
  TrendingDown,
  Loader2,
  X,
  Check,
  ArrowRightLeft,
} from "lucide-react";

export default function FacebookAdsPage() {
  const { startDate, endDate, setCustomRange } = useDateFilter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Filters & search
  const [search, setSearch] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Split / Transfer modal states
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitSourceExpense, setSplitSourceExpense] = useState<any>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferTargetDate, setTransferTargetDate] = useState("");
  const [transferTargetCampaign, setTransferTargetCampaign] = useState("");
  const [transferTargetProduct, setTransferTargetProduct] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferring, setTransferring] = useState(false);

  const parsedTransferAmount = parseFloat(transferAmount) || 0;

  const handleOpenSplit = (item: any) => {
    setSplitSourceExpense(item);
    setTransferAmount("");
    const prevDate = new Date(item.date);
    prevDate.setDate(prevDate.getDate() - 1);
    const targetDateStr = prevDate.toISOString().substring(0, 10);
    setTransferTargetDate(targetDateStr);
    setTransferTargetCampaign(item.campaign_name || "Sql");
    setTransferTargetProduct(item.product_name || "");
    setTransferNotes(`Shifted from ${item.date} (bill ₹${item.amount})`);
    setSplitModalOpen(true);
  };

  const handleExecuteSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitSourceExpense || !transferAmount || !transferTargetDate) return;

    setTransferring(true);
    try {
      const res = await fetch("/api/ads/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: splitSourceExpense.id,
          transferAmount: parseFloat(transferAmount),
          targetDate: transferTargetDate,
          targetCampaign: transferTargetCampaign,
          targetProduct: transferTargetProduct,
          notes: transferNotes,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      success(
        "Amount Shifted Successfully!",
        `₹${transferAmount} moved to ${transferTargetDate}. Original record updated to ₹${splitSourceExpense.amount - parseFloat(transferAmount)} in Google Sheet!`
      );
      setSplitModalOpen(false);
      fetchAds();
      window.dispatchEvent(new Event("refresh_data"));
    } catch (err: any) {
      error("Transfer Failed", err.message);
    } finally {
      setTransferring(false);
    }
  };

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/ads?startDate=${startDate}&endDate=${endDate}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedCampaign !== "all") url += `&campaign=${encodeURIComponent(selectedCampaign)}`;
      if (selectedProduct !== "all") url += `&productId=${encodeURIComponent(selectedProduct)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setExpenses(data.expenses || []);
        setTotalAmount(data.totalAmount || 0);
        if (data.campaigns) setCampaigns(data.campaigns);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, sortBy, sortOrder, search, selectedCampaign, selectedProduct]);

  useEffect(() => {
    fetchAds();
    fetch("/api/products")
      .then((res) => res.json())
      .then((d) => {
        if (d.products) setProducts(d.products);
      })
      .catch(console.error);

    const handleRefresh = () => fetchAds();
    window.addEventListener("refresh_data", handleRefresh);
    return () => window.removeEventListener("refresh_data", handleRefresh);
  }, [fetchAds]);

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/ads/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        success("Ad Expense Deleted", "Record removed from database");
        setDeleteConfirmId(null);
        fetchAds();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      error("Delete Failed", err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    try {
      const res = await fetch(`/api/ads/${editingExpense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingExpense),
      });
      const data = await res.json();
      if (data.success) {
        success("Ad Expense Updated", `Updated ${editingExpense.campaign_name}`);
        setEditModalOpen(false);
        setEditingExpense(null);
        fetchAds();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      error("Update Failed", err.message);
    }
  };

  const handleExport = (fmt: "csv" | "xlsx") => {
    window.open(`/api/export?target=ads&format=${fmt}&startDate=${startDate}&endDate=${endDate}`, "_blank");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-500" />
            <span>Facebook Ads Expenses</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Track daily campaign investments and attribution across products
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-card/60 backdrop-blur-md p-4 rounded-2xl border">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns, products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Campaign Filter */}
        <div>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="w-full px-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Product Filter */}
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

        {/* Sort */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
            <option value="campaign">Sort by Campaign</option>
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

      {/* Summary Banner for filtered records */}
      <div className="p-4 rounded-2xl border bg-card/60 flex items-center justify-between">
        <div>
          <span className="text-xs text-muted-foreground block">Filtered Total Ad Investment</span>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(totalAmount)}
          </span>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <span>{expenses.length} Records found</span>
        </div>
      </div>

      {/* Expense Records Table / Cards */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Loading Facebook ad records...</span>
        </div>
      ) : expenses.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border bg-card/40 text-xs text-muted-foreground space-y-3">
          <Megaphone className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="font-semibold text-sm text-foreground">No Facebook Ad expenses found for this period</p>
          <p>Click &quot;Add Entry&quot; in the top navigation or floating + button to record ad spend.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card/60 backdrop-blur-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-muted-foreground border-b uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Campaign</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Amount Spent</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map((item) => (
                <tr key={item.id} className="hover:bg-secondary/40 transition-colors">
                  <td className="py-3 px-4 font-medium whitespace-nowrap">{item.date}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-foreground">{item.campaign_name}</div>
                    {item.ad_account_name && (
                      <span className="text-[10px] text-muted-foreground">{item.ad_account_name}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground max-w-[200px] truncate">
                    {item.product_name || "General / Unattributed"}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-foreground">
                      {item.campaign_type || "Sales"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground max-w-[180px] truncate">
                    {item.notes || "--"}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenSplit(item)}
                        className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 transition-colors"
                        title="Split / Shift amount to another date"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingExpense(item);
                          setEditModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                        title="Edit record"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-secondary/50 font-bold border-t">
              <tr>
                <td colSpan={4} className="py-3 px-4 text-right uppercase text-[11px] text-muted-foreground">
                  Total Ad Spend:
                </td>
                <td className="py-3 px-4 text-right text-sm text-blue-600 dark:text-blue-400">
                  {formatCurrency(totalAmount)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && editingExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <h3 className="font-bold text-base">Edit Facebook Ad Expense</h3>
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
                  value={editingExpense.date}
                  onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={editingExpense.campaign_name}
                  onChange={(e) => setEditingExpense({ ...editingExpense, campaign_name: e.target.value })}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Amount Spent (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editingExpense.amount}
                  onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm font-bold text-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Product</label>
                <select
                  value={editingExpense.product_name || ""}
                  onChange={(e) => {
                    const prodName = e.target.value;
                    const prod = products.find((p) => p.name === prodName);
                    setEditingExpense({
                      ...editingExpense,
                      product_name: prodName,
                      product_id: prod?.id || null,
                    });
                  }}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">General / None</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <input
                  type="text"
                  value={editingExpense.notes || ""}
                  onChange={(e) => setEditingExpense({ ...editingExpense, notes: e.target.value })}
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
              Are you sure you want to permanently delete this ad expense record? This action cannot be undone.
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

      {/* Split & Transfer Modal */}
      {splitModalOpen && splitSourceExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
                  <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                  <span>Split &amp; Shift Amount to Another Date</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Is expense se kuch amount kisi aur date me transfer karein (Source se minus hoga)
                </p>
              </div>
              <button
                onClick={() => setSplitModalOpen(false)}
                className="p-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Source Info Card */}
            <div className="p-4 rounded-2xl bg-secondary/50 border mb-4 space-y-1.5">
              <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground block">
                Current Expense Record
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm block">{splitSourceExpense.campaign_name}</span>
                  <span className="text-xs text-muted-foreground">Date: {splitSourceExpense.date}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                    {formatCurrency(splitSourceExpense.amount)}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleExecuteSplit} className="space-y-4">
              {/* Transfer Amount */}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Amount to Transfer / Shift (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={splitSourceExpense.amount - 0.01}
                    required
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="e.g. 163 or 230"
                    className="w-full bg-secondary border rounded-xl pl-8 pr-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Quick amount chips */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-[11px] text-muted-foreground">Quick select:</span>
                  {[100, 163, 230, 500]
                    .filter((amt) => amt < splitSourceExpense.amount)
                    .map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTransferAmount(String(amt))}
                        className="px-2.5 py-1 rounded-lg bg-card hover:bg-secondary border text-[11px] font-semibold text-foreground transition-all"
                      >
                        ₹{amt}
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => setTransferAmount(String(Math.floor(splitSourceExpense.amount / 2)))}
                    className="px-2.5 py-1 rounded-lg bg-card hover:bg-secondary border text-[11px] font-semibold text-foreground transition-all"
                  >
                    50% (₹{Math.floor(splitSourceExpense.amount / 2)})
                  </button>
                </div>
              </div>

              {/* Real-time Math Preview Card */}
              {parsedTransferAmount > 0 && parsedTransferAmount < splitSourceExpense.amount && (
                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2 text-xs">
                  <span className="font-bold text-blue-700 dark:text-blue-300 block">
                    ⚡ Live Calculation Preview:
                  </span>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Current Record ({splitSourceExpense.date}) will become:</span>
                    <span className="font-bold text-foreground">
                      ₹{splitSourceExpense.amount} - ₹{parsedTransferAmount} ={" "}
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(splitSourceExpense.amount - parsedTransferAmount)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>New Record on ({transferTargetDate}) will be:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      +{formatCurrency(parsedTransferAmount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Target Date */}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Target Date (Jis Date me Shift Karna Hai)
                </label>
                <input
                  type="date"
                  required
                  value={transferTargetDate}
                  onChange={(e) => setTransferTargetDate(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Target Campaign (Optional) */}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Target Campaign Name
                </label>
                <input
                  type="text"
                  required
                  value={transferTargetCampaign}
                  onChange={(e) => setTransferTargetCampaign(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Target Product (Optional) */}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Attributed Product
                </label>
                <select
                  value={transferTargetProduct}
                  onChange={(e) => setTransferTargetProduct(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="">General / Unattributed</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Transferred from 11 Nov bill"
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setSplitModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    transferring ||
                    !parsedTransferAmount ||
                    parsedTransferAmount <= 0 ||
                    parsedTransferAmount >= splitSourceExpense.amount ||
                    !transferTargetDate
                  }
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                >
                  {transferring ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Transferring...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Confirm Transfer &amp; Update Sheet</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
