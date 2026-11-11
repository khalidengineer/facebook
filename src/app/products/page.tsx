"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/date-utils";
import { useToast } from "@/components/providers/ToastProvider";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  TrendingUp,
  Megaphone,
  Receipt,
  Percent,
  Layers,
  ArrowUpRight,
  X,
  Check,
  Loader2,
  BarChart2,
} from "lucide-react";

export default function ProductsPage() {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // Product detail analytics modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedProductData, setSelectedProductData] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Edit / Add modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Notes");
  const [sellingPrice, setSellingPrice] = useState("");
  const [productCost, setProductCost] = useState("0");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/products";
      if (search) url += `?search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchProducts();
    const handleRefresh = () => fetchProducts();
    window.addEventListener("refresh_data", handleRefresh);
    return () => window.removeEventListener("refresh_data", handleRefresh);
  }, [fetchProducts]);

  const openAnalytics = async (product: any) => {
    setDetailModalOpen(true);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/products/${product.id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedProductData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setName("");
    setCategory("Notes");
    setSellingPrice("");
    setProductCost("0");
    setDescription("");
    setNotes("");
    setFormModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setName(p.name);
    setCategory(p.category || "Notes");
    setSellingPrice(String(p.selling_price || 0));
    setProductCost(String(p.product_cost || 0));
    setDescription(p.description || "");
    setNotes(p.notes || "");
    setFormModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        category,
        selling_price: parseFloat(sellingPrice) || 0,
        product_cost: parseFloat(productCost) || 0,
        description,
        notes,
      };

      let res: Response;
      if (editingProduct) {
        res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        success(editingProduct ? "Product Updated" : "Product Created", `${name} saved`);
        setFormModalOpen(false);
        fetchProducts();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      error("Save Failed", err.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        success("Product Deleted", "Product removed from catalog");
        setDeleteConfirmId(null);
        fetchProducts();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      error("Delete Failed", err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-500" />
            <span>Product Management</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage your digital products, courses, handwritten notes and analyze individual ROI
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 self-start sm:self-auto shadow-sm active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search product catalog..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-secondary/80 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Loading products catalog...</span>
        </div>
      ) : products.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border bg-card/40 text-xs text-muted-foreground space-y-3">
          <Package className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="font-semibold text-sm text-foreground">No products found</p>
          <p>Click &quot;Add Product&quot; to register your first digital product or course.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-3xl border bg-card/60 backdrop-blur-md shadow-sm hover:border-border/80 transition-all space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    {p.category || "Digital Product"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(p)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                      title="Edit Product"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(p.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-base mt-2 leading-snug line-clamp-2">{p.name}</h3>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                )}
              </div>

              <div className="pt-3 border-t space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Selling Price</span>
                    <span className="font-bold text-foreground text-sm">{formatCurrency(p.selling_price)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground block text-[11px]">Base Unit Cost</span>
                    <span className="font-medium text-foreground">{formatCurrency(p.product_cost)}</span>
                  </div>
                </div>

                <button
                  onClick={() => openAnalytics(p)}
                  className="w-full py-2 px-3 rounded-xl bg-secondary/80 hover:bg-secondary text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-primary" />
                  <span>View Product Analytics</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Individual Product Analytics Modal */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div>
                <h3 className="font-bold text-base">Product Performance Analytics</h3>
                <p className="text-xs text-muted-foreground">{selectedProductData?.product?.name}</p>
              </div>
              <button onClick={() => setDetailModalOpen(false)} className="p-1 text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : selectedProductData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border bg-secondary/40">
                    <span className="text-[11px] text-muted-foreground block">Total Revenue</span>
                    <span className="font-bold text-emerald-500 text-base">
                      {formatCurrency(selectedProductData.stats.totalRevenue)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {selectedProductData.stats.totalOrders} Orders
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border bg-secondary/40">
                    <span className="text-[11px] text-muted-foreground block">Ad Spend</span>
                    <span className="font-bold text-blue-500 text-base">
                      {formatCurrency(selectedProductData.stats.totalAds)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Meta Ads investment
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border bg-secondary/40">
                    <span className="text-[11px] text-muted-foreground block">Net Profit</span>
                    <span className={`font-bold text-base ${selectedProductData.stats.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {formatCurrency(selectedProductData.stats.netProfit)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      After ads & product cost
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border bg-secondary/40">
                    <span className="text-[11px] text-muted-foreground block">Product ROAS</span>
                    <span className="font-bold text-purple-500 text-base">
                      {selectedProductData.stats.roas}x
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Revenue multiplier
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-card text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Default Selling Price:</span>
                    <span className="font-semibold">{formatCurrency(selectedProductData.product.selling_price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Allocated COGS:</span>
                    <span className="font-semibold">{formatCurrency(selectedProductData.stats.totalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-semibold">{selectedProductData.product.category}</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setDetailModalOpen(false)}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <h3 className="font-bold text-base">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h3>
              <button onClick={() => setFormModalOpen(false)} className="p-1 text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SQL Handwritten Notes"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="199.00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Unit Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={productCost}
                    onChange={(e) => setProductCost(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                <input
                  type="text"
                  placeholder="Notes, PDF, Course, eBook"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Description of the product"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Internal notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Save Product
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
            <h3 className="font-bold text-base text-rose-500">Delete Product</h3>
            <p className="text-xs text-muted-foreground mt-2">
              Are you sure you want to delete this product? Historical sales will retain the product name.
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
