"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useDateFilter } from "@/components/providers/DateFilterProvider";
import { formatCurrency } from "@/lib/date-utils";
import { useToast } from "@/components/providers/ToastProvider";
import {
  Receipt,
  Search,
  Filter,
  Download,
  Trash2,
  Edit2,
  Plus,
  Loader2,
  X,
  CreditCard,
} from "lucide-react";

export default function ExpensesPage() {
  const { startDate, endDate } = useDateFilter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [categoryTotals, setCategoryTotals] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Edit / Delete Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/expenses?startDate=${startDate}&endDate=${endDate}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedCategory !== "all") url += `&category=${encodeURIComponent(selectedCategory)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setExpenses(data.expenses || []);
        setTotalAmount(data.totalAmount || 0);
        setCategoryTotals(data.categoryTotals || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, sortBy, sortOrder, search, selectedCategory]);

  useEffect(() => {
    fetchExpenses();
    fetch("/api/products")
      .then((res) => res.json())
      .then((d) => {
        if (d.products) setProducts(d.products);
      })
      .catch(console.error);

    const handleRefresh = () => fetchExpenses();
    window.addEventListener("refresh_data", handleRefresh);
    return () => window.removeEventListener("refresh_data", handleRefresh);
  }, [fetchExpenses]);

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        success("Expense Deleted", "Record removed from database");
        setDeleteConfirmId(null);
        fetchExpenses();
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
      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingExpense),
      });
      const data = await res.json();
      if (data.success) {
        success("Expense Updated", "Changes saved to database");
        setEditModalOpen(false);
        setEditingExpense(null);
        fetchExpenses();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      error("Update Failed", err.message);
    }
  };

  const handleExport = (fmt: "csv" | "xlsx") => {
    window.open(`/api/export?target=expenses&format=${fmt}&startDate=${startDate}&endDate=${endDate}`, "_blank");
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-500" />
            <span>Other Expenses</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage hosting, domain, software, tools, freelancer and operational costs
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

      {/* Summary Card and Categories Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md">
          <span className="text-xs text-muted-foreground block">Total Other Expenses</span>
          <span className="text-2xl font-bold text-amber-500">
            {formatCurrency(totalAmount)}
          </span>
          <span className="text-[11px] text-muted-foreground block mt-1">
            {expenses.length} Expense transactions
          </span>
        </div>

        <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-md sm:col-span-2">
          <span className="text-xs text-muted-foreground block mb-2 font-medium">Category Breakdown</span>
          <div className="flex flex-wrap gap-2">
            {categoryTotals.length === 0 ? (
              <span className="text-xs text-muted-foreground">No categories recorded yet</span>
            ) : (
              categoryTotals.map((c) => (
                <div
                  key={c.category}
                  className="px-3 py-1 rounded-xl border bg-secondary/40 text-xs flex items-center gap-2"
                >
                  <span className="font-semibold text-foreground">{c.category}</span>
                  <span className="text-muted-foreground font-mono">{formatCurrency(c.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-card/60 backdrop-blur-md p-4 rounded-2xl border">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search expenses, descriptions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Categories</option>
            <option value="Domain">Domain</option>
            <option value="Hosting">Hosting</option>
            <option value="Software">Software</option>
            <option value="Subscription">Subscription</option>
            <option value="Marketing">Marketing</option>
            <option value="Payment Gateway">Payment Gateway</option>
            <option value="Freelancer">Freelancer</option>
            <option value="Design">Design</option>
            <option value="Miscellaneous">Miscellaneous</option>
          </select>
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
            <option value="category">Sort by Category</option>
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

      {/* Expenses Table */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Loading expenses...</span>
        </div>
      ) : expenses.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border bg-card/40 text-xs text-muted-foreground space-y-3">
          <Receipt className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="font-semibold text-sm text-foreground">No other expenses found for this period</p>
          <p>Click &quot;Add Entry&quot; in the header to record software or hosting costs.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card/60 backdrop-blur-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-muted-foreground border-b uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expenses.map((item) => (
                <tr key={item.id} className="hover:bg-secondary/40 transition-colors">
                  <td className="py-3 px-4 font-medium whitespace-nowrap">{item.date}</td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-foreground max-w-[220px] truncate">
                    {item.description}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                    {item.payment_method || "UPI"}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-amber-500 whitespace-nowrap">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground max-w-[160px] truncate">
                    {item.notes || "--"}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditingExpense(item);
                          setEditModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                        title="Edit expense"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500"
                        title="Delete expense"
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
                  Total Other Expenses:
                </td>
                <td className="py-3 px-4 text-right text-sm text-amber-500">
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
              <h3 className="font-bold text-base">Edit Expense</h3>
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                <select
                  value={editingExpense.category}
                  onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                >
                  <option value="Domain">Domain</option>
                  <option value="Hosting">Hosting</option>
                  <option value="Software">Software</option>
                  <option value="Subscription">Subscription</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Payment Gateway">Payment Gateway</option>
                  <option value="Freelancer">Freelancer</option>
                  <option value="Design">Design</option>
                  <option value="Miscellaneous">Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={editingExpense.description}
                  onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editingExpense.amount}
                  onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm font-bold text-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Method</label>
                <select
                  value={editingExpense.payment_method || "UPI"}
                  onChange={(e) => setEditingExpense({ ...editingExpense, payment_method: e.target.value })}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                >
                  <option value="UPI">UPI</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
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
              Are you sure you want to permanently delete this expense?
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
                Delete Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
