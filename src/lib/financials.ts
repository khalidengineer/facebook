import {
  fetchLiveSheetData,
  RevenueItem,
  AdExpenseItem,
  OtherExpenseItem,
  ProductItem,
} from "./sheet-db";

export interface DateFilter {
  startDate: string;
  endDate: string;
  productId?: number | string | null;
  productName?: string | null;
}

export interface FinancialSummary {
  totalAdSpend: number;
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalOtherExpenses: number;
  totalProductCost: number;
  totalRefunds: number;
  totalDeductions: number;
  netProfit: number;
  totalProducts: number;
  totalOrders: number;
  totalReceivedOrders: number;
  totalCancelledOrders: number;
  totalCancelledAmount: number;
  roas: number;
  avgDailyAdSpend: number;
  costPerSale: number;
  currencySymbol: string;
}

export async function getFinancialSummary(filter: DateFilter): Promise<FinancialSummary> {
  const db = await fetchLiveSheetData();
  const { startDate, endDate, productId, productName } = filter;

  // 1. Filter Facebook Ads
  const filteredAds = db.facebookAds.filter((ad) => {
    if (ad.date < startDate || ad.date > endDate) return false;
    if (productName && ad.product_name && ad.product_name.toLowerCase() !== productName.toLowerCase()) return false;
    return true;
  });

  const totalAdSpend = filteredAds.reduce((sum, a) => sum + (a.amount || 0), 0);
  const uniqueAdDays = new Set(filteredAds.map((a) => a.date)).size;

  // 2. Filter Revenues
  const allFilteredRevenues = db.revenues.filter((rev) => {
    if (rev.date < startDate || rev.date > endDate) return false;
    if (productName && rev.product_name && rev.product_name.toLowerCase() !== productName.toLowerCase()) return false;
    return true;
  });

  const filteredRevenues = allFilteredRevenues.filter((rev) => !rev.status || rev.status.toLowerCase() === "received");
  const cancelledRevenues = allFilteredRevenues.filter((rev) => rev.status && rev.status.toLowerCase().includes("cancelled"));

  const totalGrossRevenue = filteredRevenues.reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalNetRevenue = filteredRevenues.reduce((sum, r) => sum + (r.net_amount || r.amount || 0), 0);
  const totalProductCost = filteredRevenues.reduce((sum, r) => sum + (r.product_cost || 0), 0);
  const totalOrders = filteredRevenues.length;
  const totalReceivedOrders = filteredRevenues.length;
  const totalCancelledOrders = cancelledRevenues.length;
  const totalCancelledAmount = Math.round(cancelledRevenues.reduce((sum, r) => sum + (r.amount || 0), 0) * 100) / 100;
  const totalDeductions = Math.max(0, Math.round((totalGrossRevenue - totalNetRevenue) * 100) / 100);
  const totalRefunds = 0;

  // 3. Filter Other Expenses
  const filteredExpenses = db.otherExpenses.filter((exp) => {
    if (exp.date < startDate || exp.date > endDate) return false;
    return true;
  });

  const totalOtherExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // 4. Products count
  const totalProducts = db.products.length;

  // Net Profit = Net Revenue - Ad Spend - Other Expenses - Product Cost
  const revenueBasis = totalNetRevenue > 0 ? totalNetRevenue : totalGrossRevenue - totalDeductions;
  const netProfit = Math.round((revenueBasis - totalAdSpend - totalOtherExpenses - totalProductCost) * 100) / 100;

  // ROAS
  const roas = totalAdSpend > 0 ? Math.round((totalGrossRevenue / totalAdSpend) * 100) / 100 : 0;

  // Average daily ad spend
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const diffDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const avgDailyAdSpend = Math.round((totalAdSpend / diffDays) * 100) / 100;

  // Cost Per Sale (CPA) = Total Ad Spend / Received Orders
  const costPerSale = totalReceivedOrders > 0
    ? Math.round((totalAdSpend / totalReceivedOrders) * 100) / 100
    : 0;

  return {
    totalAdSpend: Math.round(totalAdSpend * 100) / 100,
    totalGrossRevenue: Math.round(totalGrossRevenue * 100) / 100,
    totalNetRevenue: Math.round(totalNetRevenue * 100) / 100,
    totalOtherExpenses: Math.round(totalOtherExpenses * 100) / 100,
    totalProductCost: Math.round(totalProductCost * 100) / 100,
    totalRefunds,
    totalDeductions,
    netProfit,
    totalProducts,
    totalOrders,
    totalReceivedOrders,
    totalCancelledOrders,
    totalCancelledAmount,
    roas,
    avgDailyAdSpend,
    costPerSale,
    currencySymbol: "₹",
  };
}

export interface DailyFinancialRow {
  date: string;
  adSpend: number;
  revenue: number;
  netRevenue: number;
  otherExpenses: number;
  productCost: number;
  profit: number;
  orders: number;
  roas: number;
  costPerSale: number;
}

export async function getDateWiseReport(filter: DateFilter): Promise<DailyFinancialRow[]> {
  const db = await fetchLiveSheetData();
  const { startDate, endDate, productName } = filter;

  const dateMap = new Map<
    string,
    { adSpend: number; gross: number; net: number; cost: number; otherExpenses: number; orders: number }
  >();

  const getOrCreate = (d: string) => {
    let entry = dateMap.get(d);
    if (!entry) {
      entry = { adSpend: 0, gross: 0, net: 0, cost: 0, otherExpenses: 0, orders: 0 };
      dateMap.set(d, entry);
    }
    return entry;
  };

  // 1. Ads
  db.facebookAds.forEach((ad) => {
    if (ad.date < startDate || ad.date > endDate) return;
    if (productName && ad.product_name && ad.product_name.toLowerCase() !== productName.toLowerCase()) return;
    const item = getOrCreate(ad.date);
    item.adSpend += ad.amount || 0;
  });

  // 2. Revenues
  db.revenues.forEach((rev) => {
    if (rev.date < startDate || rev.date > endDate) return;
    if (productName && rev.product_name && rev.product_name.toLowerCase() !== productName.toLowerCase()) return;
    if (rev.status && rev.status.toLowerCase() !== "received") return;
    const item = getOrCreate(rev.date);
    item.gross += rev.amount || 0;
    item.net += rev.net_amount || rev.amount || 0;
    item.cost += rev.product_cost || 0;
    item.orders += 1;
  });

  // 3. Other Expenses
  db.otherExpenses.forEach((exp) => {
    if (exp.date < startDate || exp.date > endDate) return;
    const item = getOrCreate(exp.date);
    item.otherExpenses += exp.amount || 0;
  });

  const sortedDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));

  return sortedDates.map((date) => {
    const val = dateMap.get(date)!;
    const profit = Math.round((val.net - val.adSpend - val.otherExpenses - val.cost) * 100) / 100;
    const roas = val.adSpend > 0 ? Math.round((val.gross / val.adSpend) * 100) / 100 : 0;
    const costPerSale = val.orders > 0 ? Math.round((val.adSpend / val.orders) * 100) / 100 : 0;

    return {
      date,
      adSpend: Math.round(val.adSpend * 100) / 100,
      revenue: Math.round(val.gross * 100) / 100,
      netRevenue: Math.round(val.net * 100) / 100,
      otherExpenses: Math.round(val.otherExpenses * 100) / 100,
      productCost: Math.round(val.cost * 100) / 100,
      profit,
      orders: val.orders,
      roas,
      costPerSale,
    };
  });
}

export interface ProductPerformanceRow {
  productId: string;
  productName: string;
  category: string;
  sellingPrice: number;
  unitCost: number;
  orders: number;
  revenue: number;
  netRevenue: number;
  adSpend: number;
  otherExpenses: number;
  productCost: number;
  netProfit: number;
  roas: number;
  marginPercent: number;
}

export async function getProductWiseReport(filter: { startDate: string; endDate: string }): Promise<ProductPerformanceRow[]> {
  const db = await fetchLiveSheetData();
  const { startDate, endDate } = filter;

  return db.products.map((p) => {
    const pName = p.name.toLowerCase();

    // Ad spend for this product
    const prodAds = db.facebookAds.filter(
      (a) => a.date >= startDate && a.date <= endDate && a.product_name && a.product_name.toLowerCase() === pName
    );
    const adSpend = prodAds.reduce((sum, a) => sum + (a.amount || 0), 0);

    // Revenues for this product
    const prodRevs = db.revenues.filter(
      (r) =>
        r.date >= startDate &&
        r.date <= endDate &&
        r.product_name &&
        r.product_name.toLowerCase() === pName &&
        (!r.status || r.status.toLowerCase() === "received")
    );
    const orders = prodRevs.length;
    const revenue = prodRevs.reduce((sum, r) => sum + (r.amount || 0), 0);
    const netRevenue = prodRevs.reduce((sum, r) => sum + (r.net_amount || r.amount || 0), 0);
    const productCost = p.product_cost * orders;

    const netProfit = Math.round((netRevenue - adSpend - productCost) * 100) / 100;
    const roas = adSpend > 0 ? Math.round((revenue / adSpend) * 100) / 100 : 0;
    const marginPercent = revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0;

    return {
      productId: p.id,
      productName: p.name,
      category: p.category,
      sellingPrice: p.selling_price,
      unitCost: p.product_cost,
      orders,
      revenue: Math.round(revenue * 100) / 100,
      netRevenue: Math.round(netRevenue * 100) / 100,
      adSpend: Math.round(adSpend * 100) / 100,
      otherExpenses: 0,
      productCost: Math.round(productCost * 100) / 100,
      netProfit,
      roas,
      marginPercent,
    };
  });
}
