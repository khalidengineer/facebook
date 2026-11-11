# AdSpend Pro – Facebook Ads Expense & Profit Management PWA

A full-stack, production-quality Next.js Progressive Web Application (PWA) built specifically for personal Facebook/Meta advertising expense tracking, product-wise sales revenue, operational overheads, and real-time net profit/loss calculations.

Directly connected to `./expense.db` SQLite database with native zero-data-loss architecture and automated CSV import mapping for Cosmofeed exports (`data.csv`) and Meta Ads reports.

---

## 🚀 Key Features

### 1. Instant Dashboard (No Login or Authentication Required)
- **10 Core Metric Cards**:
  1. Total Facebook Ads Spend
  2. Total Revenue (Gross Customer Paid & Net Earned)
  3. Total Other Expenses
  4. Total Product Cost (COGS)
  5. Fees & Deductions
  6. Net Profit / Net Loss
  7. Active Catalog Products
  8. Average Daily Ad Spend
  9. Total Orders Received
  10. Return on Ad Spend (ROAS)
- **Date Range Filters**: Today, Yesterday, Last 7 Days, Last 30 Days (default), This Month, Last Month, This Year, All Time, and Custom Date Range.
- **Interactive Recharts**:
  - Daily Revenue vs Facebook Ad Spend Area Chart
  - Daily Net Profit/Loss Bar Chart
  - Product-wise Revenue vs Ad Spend Horizontal Bar Chart
  - Monthly Expense vs Revenue Rollup Chart

### 2. Facebook Ads Expense Management (`/ads`)
- Date-wise recording of Meta / Facebook advertising spend
- Attributes: Date, Campaign Name, Ad Account Name, Product Name, Campaign Objective/Type (Sales, Conversions, Leads, Traffic), Amount Spent (₹ INR), Notes
- Filter by date, campaign name, and product
- Sort by date, amount, and campaign
- Full Add, Edit, and Delete (with confirmation dialog) support
- Date-wise breakdown table with total ad spend summary
- Direct CSV and Excel (.xlsx) export

### 3. Product Catalog & Unit Economics (`/products`)
- Digital notes, PDFs, courses, and physical product catalog
- Attributes: Product Name, Category, Default Selling Price, Product Unit Cost, Description, Status, Notes
- **Individual Product Analytics**: View product-specific gross revenue, net revenue, ad investment, orders count, net profit, and ROAS

### 4. Revenue & Sales Management (`/revenue`)
- Record customer revenue manually or import directly from payment gateways (Cosmofeed)
- Tracks Customer Email, Phone, Payment ID, Order Count, Gross Amount, Net Earned, Platform Fee Deductions, and Attributed Campaign
- Works with or without campaign attribution (supports organic/direct sales)

### 5. Other Expenses Management (`/expenses`)
- Categorized operational expense tracker
- Categories: Domain, Hosting, Software, Subscription, Marketing, Payment Gateway, Freelancer, Design, Miscellaneous
- Tracks payment method (UPI, Credit Card, Debit Card, Bank Transfer, Cash), date, description, and amount

### 6. Date-wise Financial Statement (`/reports/date-wise`)
- Dedicated daily accounting table:
  `Date | Facebook Ads | Gross Revenue | Net Revenue | Other Expenses | Product Cost | Net Profit/Loss | ROAS | Breakdown`
- **Interactive Drilldown**: Clicking any date row opens the detailed transactions breakdown for that specific day (individual ads, orders, and expenses)

### 7. Product-wise Profit & Loss Report (`/reports/product-wise`)
- Product unit economics table:
  `Product | Orders | Gross Revenue | Net Revenue | FB Ad Spend | Product Cost | Other Expenses | Net Profit | ROAS | Margin %`
- **Highlight Badges**:
  - Most Profitable Product
  - Highest Ad Spend Product
  - Highest ROAS Product
  - Products running at a loss (where ad spend exceeds revenue)

### 8. Monthly Calendar View (`/calendar`)
- Monthly visual grid showing daily profit badges
- Green indicator for profitable days, red for loss-making days
- Clicking any day opens the complete daily accounting audit

### 9. Centralized Transaction Ledger (`/transactions`)
- Chronological timeline combining Facebook Ads, Sales Revenues, and Business Expenses
- Filter by transaction type, date range, product, and search queries
- Pagination and transaction details modal

### 10. CSV Import System (`/import`)
- Auto-detects Cosmofeed transaction CSVs (`data.csv`) and Facebook Ads reports
- **One-Click Import**: "Load Existing data.csv" button detects the sample file in project root and previews 61 sales records
- **Duplicate Prevention**: Automatically compares `Payment ID` and transaction hashes to prevent importing identical sales repeatedly
- Validates rows, filters cancelled transactions, and creates import history

### 11. SQLite Backup & Restore (`/backup`)
- One-click download of the complete `expense.db` SQLite file
- Full CSV and Excel export across all time
- Safe restore: Validates SQLite file header and automatically creates a safety snapshot before applying restore

### 12. Progressive Web App (PWA) Support
- Standalone display mode with custom icons (`icon-192.png`, `icon-512.png`)
- Web App Manifest (`manifest.json`)
- Offline application shell caching via Service Worker (`sw.js`)
- Online / Offline connectivity indicator pill
- Mobile-first bottom navigation bar and floating "+" action button
- Professional Dark and Light theme switcher

---

## 🛠️ Quick Start & Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build & Start
```bash
npm run build
npm run start
```

---

## 📁 Project Structure

```
├── data.csv                  # Existing Cosmofeed sales CSV sample
├── expense.db                # Existing SQLite database
├── public/
│   ├── manifest.json         # PWA Manifest
│   ├── sw.js                 # PWA Service Worker
│   ├── icon-192.png          # App Icon (192x192)
│   └── icon-512.png          # App Icon (512x512)
├── src/
│   ├── app/
│   │   ├── api/              # Secure Next.js Server Route Handlers
│   │   │   ├── ads/          # Facebook Ads API
│   │   │   ├── backup/       # Database Backup & Restore API
│   │   │   ├── dashboard/    # Analytics & Recharts Summary API
│   │   │   ├── expenses/     # Other Expenses API
│   │   │   ├── export/       # CSV & Excel Export API
│   │   │   ├── import/       # CSV Parser & Importer API
│   │   │   ├── products/     # Products Catalog & Performance API
│   │   │   ├── reports/      # Date-wise & Product-wise Financial Reports API
│   │   │   ├── revenues/     # Revenue & Sales API
│   │   │   ├── settings/     # App Settings API
│   │   │   └── transactions/ # Centralized Ledger API
│   │   ├── ads/              # Facebook Ads Page
│   │   ├── backup/           # Backup & Restore Page
│   │   ├── calendar/         # Monthly Calendar Page
│   │   ├── expenses/         # Other Expenses Page
│   │   ├── import/           # CSV Import Page
│   │   ├── products/         # Products Catalog Page
│   │   ├── reports/          # Reports Pages
│   │   ├── revenue/          # Revenue & Sales Page
│   │   ├── settings/         # Settings Page
│   │   ├── transactions/     # Centralized Ledger Page
│   │   ├── layout.tsx        # App Shell Layout with PWA Setup
│   │   └── page.tsx          # Dashboard Home Page
│   ├── components/
│   │   ├── layout/           # Sidebar, BottomNav, Header, AppShell
│   │   ├── modals/           # QuickAddModal (+)
│   │   └── providers/        # ThemeProvider, DateFilterProvider, ToastProvider
│   └── lib/
│       ├── csv-importer.ts   # Cosmofeed & Generic CSV Engine with Dedup
│       ├── date-utils.ts     # Date parser & normalizer for DD MMM, YYYY
│       ├── db.ts             # SQLite Database Connection & Schema Migrations
│       ├── financials.ts     # P&L calculation & ROAS analytics engine
│       └── utils.ts          # Tailwind CSS merge utility
└── package.json
```

---

## 🔒 Security & Data Integrity
- All database queries run exclusively on the server side using parameterized statements.
- Never exposes raw database credentials or direct database access to the client browser.
- Safe schema migrations use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
- Floating-point calculations are rounded safely to 2 decimal places to prevent precision drift.

---

## 🌐 Live Deployment Guide (GitHub + Vercel / Render)

### Important Note Regarding GitHub Pages
> **Why Not GitHub Pages?**  
> GitHub Pages only hosts static static client files (HTML, CSS, JS). This project is a **full-stack Next.js 15 application** with dynamic backend API routes (`/api/ads`, `/api/dashboard`, `/api/sheets`, etc.) and Google Sheets live integration.  
> Therefore, deploying directly to **Vercel** (recommended, 100% free) or **Render** connected to your GitHub repository provides seamless live hosting with 1-click updates.

### Option 1: Deploy to Vercel (Recommended & 1-Click Free Hosting)
1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Configure project for GitHub live deployment"
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
3. Click **"Add New..."** > **"Project"**.
4. Select the repository: `khalidengineer/facebook`.
5. Under Environment Variables (optional, defaults are already configured in `sheet-config.json`):
   - `GOOGLE_SHEET_ID`: (Your Google Sheet ID)
   - `GOOGLE_SHEET_WEBHOOK_URL`: (Your Apps Script Webhook URL)
6. Click **Deploy**. Your app will be live with an SSL HTTPS domain (e.g., `https://facebook-ads-spend.vercel.app`) in under 2 minutes!
7. Any future commit pushed to GitHub will automatically redeploy the live website.

### Option 2: Deploy to Render / Docker / Railway
1. A production-ready `Dockerfile` and `.dockerignore` are included in the repository root.
2. On Render.com, create a **New Web Service**, connect `khalidengineer/facebook`, and select **Docker** as runtime.
3. Set the port to `3000` and deploy.

