"use client";

import React, { useState, useEffect } from "react";
import { X, Megaphone, TrendingUp, Receipt, Package, Check, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function QuickAddModal({ isOpen, onClose, onSuccess }: QuickAddModalProps) {
  const { success, error, warning } = useToast();
  const [activeTab, setActiveTab] = useState<"ad" | "revenue" | "expense" | "product">("ad");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [hasWebhook, setHasWebhook] = useState(false);

  // Form states
  const today = new Date().toISOString().substring(0, 10);
  const [date, setDate] = useState(today);

  // Ad states
  const [campaignName, setCampaignName] = useState("");
  const [adAccountName, setAdAccountName] = useState("");
  const [adProductId, setAdProductId] = useState("");
  const [campaignType, setCampaignType] = useState("Sales");
  const [adAmount, setAdAmount] = useState("");
  const [adNotes, setAdNotes] = useState("");

  // Revenue states
  const [revProductId, setRevProductId] = useState("");
  const [revCampaignName, setRevCampaignName] = useState("");
  const [orderCount, setOrderCount] = useState("1");
  const [revAmount, setRevAmount] = useState("");
  const [revNetAmount, setRevNetAmount] = useState("");
  const [revProductCost, setRevProductCost] = useState("");
  const [revNotes, setRevNotes] = useState("");

  // Expense states
  const [expenseCategory, setExpenseCategory] = useState("Software");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseProductId, setExpenseProductId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [expenseNotes, setExpenseNotes] = useState("");

  // Product states
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState("Digital Notes");
  const [prodPrice, setProdPrice] = useState("");
  const [prodCost, setProdCost] = useState("0");
  const [prodDesc, setProdDesc] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetch("/api/products")
        .then((res) => res.json())
        .then((data) => {
          if (data.products) setProducts(data.products);
        })
        .catch(console.error);

      fetch("/api/sheets/config")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.config?.webhookUrl) {
            setHasWebhook(true);
          } else {
            setHasWebhook(false);
          }
        })
        .catch(() => setHasWebhook(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeTab === "ad") {
        const selectedProd = products.find((p) => String(p.id) === adProductId);
        const res = await fetch("/api/ads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            campaign_name: campaignName,
            ad_account_name: adAccountName,
            product_id: adProductId || null,
            product_name: selectedProd?.name || null,
            campaign_type: campaignType,
            amount: adAmount,
            notes: adNotes,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        if (!data.sheetSynced) {
          warning(
            "Saved locally!",
            "Google Sheet Webhook not connected yet. Data will not appear in Google Sheet until Apps Script URL is saved."
          );
        } else {
          success("Recorded in Google Sheet!", `₹${adAmount} for ${campaignName} added directly to Google Sheet`);
        }
      } else if (activeTab === "revenue") {
        const selectedProd = products.find((p) => String(p.id) === revProductId);
        const res = await fetch("/api/revenues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            product_id: revProductId || null,
            product_name: selectedProd?.name || "Direct Sale",
            campaign_name: revCampaignName,
            order_count: orderCount,
            amount: revAmount,
            net_amount: revNetAmount || revAmount,
            product_cost: revProductCost || 0,
            notes: revNotes,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        if (!data.sheetSynced) {
          warning("Saved locally!", "Google Sheet Webhook not connected yet. Go to Google Sheets Hub to connect.");
        } else {
          success("Recorded in Google Sheet!", `₹${revAmount} revenue added directly to Google Sheet`);
        }
      } else if (activeTab === "expense") {
        const selectedProd = products.find((p) => String(p.id) === expenseProductId);
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            category: expenseCategory,
            description: expenseDesc,
            amount: expenseAmount,
            product_id: expenseProductId || null,
            product_name: selectedProd?.name || null,
            payment_method: paymentMethod,
            notes: expenseNotes,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        if (!data.sheetSynced) {
          warning("Saved locally!", "Google Sheet Webhook not connected yet. Go to Google Sheets Hub to connect.");
        } else {
          success("Recorded in Google Sheet!", `₹${expenseAmount} for ${expenseCategory} added directly to Google Sheet`);
        }
      } else if (activeTab === "product") {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: prodName,
            category: prodCategory,
            selling_price: prodPrice,
            product_cost: prodCost,
            description: prodDesc,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        if (!data.sheetSynced) {
          warning("Saved locally!", "Google Sheet Webhook not connected yet. Go to Google Sheets Hub to connect.");
        } else {
          success("Product Created in Sheet!", `${prodName} added to Google Sheet Products tab`);
        }
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      error("Submission Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg">Add New Record</h2>
              {hasWebhook ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  ● Google Sheet Synced
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  ▲ Sheet Write Pending
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Target data store: Google Sheet (1LfzTmzaUpybViSZ2g-lKgr7v4NbMoNogIOz_IYtReVA)
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning if Webhook is not connected */}
        {!hasWebhook && (
          <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 px-5 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                <strong>Sheet Write Disconnected:</strong> Apps Script Web App URL set nahi hai. Data Sheet me save karne ke liye connect karein.
              </span>
            </div>
            <a
              href="/sheets"
              onClick={onClose}
              className="font-bold underline text-amber-600 dark:text-amber-400 whitespace-nowrap hover:text-amber-700 inline-flex items-center gap-1"
            >
              <span>Connect</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex p-2 bg-secondary/50 border-b gap-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("ad")}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "ad" ? "bg-card shadow-sm text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>FB Ad</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("revenue")}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "revenue" ? "bg-card shadow-sm text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Revenue</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("expense")}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "expense" ? "bg-card shadow-sm text-amber-600 dark:text-amber-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Expense</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("product")}
            className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "product" ? "bg-card shadow-sm text-purple-600 dark:text-purple-400" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Product</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Facebook Ad Tab */}
          {activeTab === "ad" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Amount Spent (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={adAmount}
                    onChange={(e) => setAdAmount(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Campaign Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SQL Notes - Conversions - Nov"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Related Product</label>
                  <select
                    value={adProductId}
                    onChange={(e) => setAdProductId(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">General / None</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Campaign Type</label>
                  <select
                    value={campaignType}
                    onChange={(e) => setCampaignType(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Conversions">Conversions</option>
                    <option value="Traffic">Traffic</option>
                    <option value="Leads">Leads</option>
                    <option value="Engagement">Engagement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Ad Account (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Meta Ads Account 01"
                  value={adAccountName}
                  onChange={(e) => setAdAccountName(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Additional observations or notes"
                  value={adNotes}
                  onChange={(e) => setAdNotes(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </>
          )}

          {/* Revenue Tab */}
          {activeTab === "revenue" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Gross Revenue (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={revAmount}
                    onChange={(e) => setRevAmount(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Product *</label>
                <select
                  required
                  value={revProductId}
                  onChange={(e) => setRevProductId(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (₹{p.selling_price})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Orders Count</label>
                  <input
                    type="number"
                    min="1"
                    value={orderCount}
                    onChange={(e) => setOrderCount(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Net Earned (₹ optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="After gateway fee"
                    value={revNetAmount}
                    onChange={(e) => setRevNetAmount(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Campaign (Optional)</label>
                <input
                  type="text"
                  placeholder="Attributed FB Campaign (if any)"
                  value={revCampaignName}
                  onChange={(e) => setRevCampaignName(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Customer or transaction details"
                  value={revNotes}
                  onChange={(e) => setRevNotes(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </>
          )}

          {/* Expense Tab */}
          {activeTab === "expense" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm font-semibold text-rose-500 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Category *</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Canva Pro monthly subscription"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Related Product (Optional)</label>
                <select
                  value={expenseProductId}
                  onChange={(e) => setExpenseProductId(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">General Overhead</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Invoice number or notes"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </>
          )}

          {/* Product Tab */}
          {activeTab === "product" && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full Stack Web Development Notes"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
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
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Product Unit Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={prodCost}
                    onChange={(e) => setProdCost(e.target.value)}
                    className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
                <input
                  type="text"
                  placeholder="Notes, PDF, Course, eBook"
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Short description of the product"
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  className="w-full bg-secondary border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </>
          )}

          {/* Footer Submit */}
          <div className="pt-3 border-t flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium border hover:bg-secondary text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Record</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
