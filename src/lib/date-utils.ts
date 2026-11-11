import { parse, format, isValid, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";

/**
 * Parses diverse date string formats (Cosmofeed, ISO, DD/MM/YYYY, MM/DD/YYYY, etc.)
 * Returns normalized YYYY-MM-DD string or null if unparseable
 */
export function normalizeDateToISO(dateStr: string | null | undefined): string | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const clean = dateStr.trim();
  if (!clean || clean === "--" || clean === "N/A" || clean === "-") return null;

  // Check if already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Handle Cosmofeed format: "11 Nov, 2026 10:56 AM" or "11 Nov 2026"
  // Remove possible commas and extra whitespace
  const cosmofeedRegex = /^(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?)?/;
  const cfMatch = clean.match(cosmofeedRegex);
  if (cfMatch) {
    const day = cfMatch[1].padStart(2, "0");
    const monthName = cfMatch[2].substring(0, 3).toLowerCase();
    const year = cfMatch[3];
    const monthMap: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const month = monthMap[monthName];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try standard formats with date-fns
  const candidateFormats = [
    "yyyy-MM-dd",
    "yyyy/MM/dd",
    "dd-MM-yyyy",
    "dd/MM/yyyy",
    "MM/dd/yyyy",
    "d MMM, yyyy h:mm a",
    "d MMM, yyyy hh:mm a",
    "dd MMM, yyyy h:mm a",
    "dd MMM, yyyy hh:mm a",
    "d MMM yyyy",
    "dd MMM yyyy",
    "yyyy-MM-dd'T'HH:mm:ss.SSSX",
    "yyyy-MM-dd'T'HH:mm:ssX"
  ];

  for (const fmt of candidateFormats) {
    try {
      const parsed = parse(clean, fmt, new Date());
      if (isValid(parsed) && parsed.getFullYear() > 2000 && parsed.getFullYear() < 2100) {
        return format(parsed, "yyyy-MM-dd");
      }
    } catch {
      // continue to next format
    }
  }

  // Fallback to Date.parse
  const nativeTime = Date.parse(clean);
  if (!isNaN(nativeTime)) {
    const d = new Date(nativeTime);
    if (d.getFullYear() > 2000 && d.getFullYear() < 2100) {
      return format(d, "yyyy-MM-dd");
    }
  }

  return null;
}

/**
 * Minimum tracking baseline date (10/11/2026).
 * No data prior to this date will be displayed anywhere in the application.
 */
export const MIN_DATA_DATE = "2026-11-10";

/**
 * Returns { startDate, endDate } for common dashboard presets
 */
export function getDateRangeFromPreset(preset: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");

  let range = { startDate: todayStr, endDate: todayStr };

  switch (preset) {
    case "today":
      range = { startDate: todayStr, endDate: todayStr };
      break;
    case "yesterday": {
      const y = format(subDays(now, 1), "yyyy-MM-dd");
      range = { startDate: y, endDate: y };
      break;
    }
    case "last_7_days": {
      range = {
        startDate: format(subDays(now, 6), "yyyy-MM-dd"),
        endDate: todayStr,
      };
      break;
    }
    case "last_30_days": {
      range = {
        startDate: format(subDays(now, 29), "yyyy-MM-dd"),
        endDate: todayStr,
      };
      break;
    }
    case "this_month": {
      range = {
        startDate: format(startOfMonth(now), "yyyy-MM-dd"),
        endDate: format(endOfMonth(now), "yyyy-MM-dd"),
      };
      break;
    }
    case "last_month": {
      const lastMonthDate = subMonths(now, 1);
      range = {
        startDate: format(startOfMonth(lastMonthDate), "yyyy-MM-dd"),
        endDate: format(endOfMonth(lastMonthDate), "yyyy-MM-dd"),
      };
      break;
    }
    case "this_year": {
      range = {
        startDate: format(startOfYear(now), "yyyy-MM-dd"),
        endDate: format(endOfYear(now), "yyyy-MM-dd"),
      };
      break;
    }
    case "all_time": {
      range = {
        startDate: MIN_DATA_DATE,
        endDate: format(endOfYear(now), "yyyy-MM-dd"),
      };
      break;
    }
    case "custom":
    default:
      range = {
        startDate: customStart || MIN_DATA_DATE,
        endDate: customEnd || todayStr,
      };
      break;
  }

  // Enforce baseline minimum date (10/11/2026)
  if (range.startDate < MIN_DATA_DATE) {
    range.startDate = MIN_DATA_DATE;
  }
  if (range.endDate < MIN_DATA_DATE) {
    range.endDate = MIN_DATA_DATE;
  }

  return range;
}

/**
 * Formats monetary amounts safely as Indian Rupee or specified currency
 */
export function formatCurrency(amount: number | null | undefined, currencySymbol = "₹"): string {
  if (amount == null || isNaN(amount)) return `${currencySymbol}0.00`;
  const isNegative = amount < 0;
  const absVal = Math.abs(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? "-" : ""}${currencySymbol}${absVal}`;
}
