# EVA POS Desktop

EVA POS is an enterprise-grade desktop Point of Sale (POS) and retail management application designed for retail stores, boutiques, and multi-branch operations. Built with Electron, React, TypeScript, and SQLite, it runs fully offline with local-first data resilience, thermal receipt printing, ESC/POS cash drawer integration, multi-cart cashier profiles, dual-currency accounting (IQD/USD), and a real-time mobile companion scanner.

---

## Table of Contents
1. [Key Features](#key-features)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Getting Started & Development](#getting-started--development)
5. [Core Business & Financial Logic](#core-business--financial-logic)
   - [Session-Based Shift Closing & Z-Report](#session-based-shift-closing--z-report)
   - [Sales, Discounts & Cost Tracking](#sales-discounts--cost-tracking)
   - [Returns, Exchanges & Stock Direction](#returns-exchanges--stock-direction)
   - [Dual-Currency System (IQD & USD)](#dual-currency-system-iqd--usd)
6. [Comprehensive System Audit & Issue Log](#comprehensive-system-audit--issue-log)
   - [Pillar 1: Financial & Register Logic](#pillar-1-financial--register-logic)
   - [Pillar 2: UI / UX & Front-of-House](#pillar-2-ui--ux--front-of-house)
   - [Pillar 3: Performance, Database & Scalability](#pillar-3-performance-database--scalability)
   - [Pillar 4: Security, Access Control & Reliability](#pillar-4-security-access-control--reliability)
7. [Prioritized Roadmap Matrix](#prioritized-roadmap-matrix)
8. [Build & Packaging](#build--packaging)

---

## Key Features

- **High-Speed Point of Sale**: Barcode scanner integration with automatic UPC-A/EAN-13 padding, multi-profile carts (serve up to 4 customers simultaneously), rapid item lookup, and keyboard-first cashier shortcuts (`F1`–`F10`).
- **Session-Based Shift Management**: Z-Reports tied to actual store operating shifts rather than calendar midnight, enabling seamless late-night trading (e.g. closing at 2:00 AM) without splitting sales across days.
- **Hardware Integration**: Silent thermal receipt printing (80mm / 58mm), A4 invoice printing, ESC/POS raw pulse cash drawer kicking (`ESC p 0 25 250`), debounced drawer control, and printable barcode labels.
- **Dual-Currency (IQD / USD)**: Wholesale costs tracked in USD; retail pricing, sales, and register cash counted in Iraqi Dinars (IQD) with live exchange rate conversions.
- **Inventory & Returns**: Real-time stock decrement, multi-variant products (size/color/season), returns and exchanges with directional inventory adjustment (`exchange_in` vs `exchange_out`), and bulk Excel import/export.
- **Mobile Companion Scanner**: Built-in HTTPS/WebSocket local companion server enabling smartphones on the local Wi-Fi to scan barcodes and look up product details without external cloud dependencies.
- **Data Protection & Reliability**: SQLite in WAL mode (`Write-Ahead Logging`), automatic daily backups rotated in the user documents directory, and full offline functionality.

---

## Architecture Overview

```
eva-pos/
├── electron/                   # Electron Main Process & Native Node APIs
│   ├── main.ts                 # Window lifecycle, updater, and IPC registration
│   ├── preload.ts              # Secure contextBridge exposing window.evaApi
│   ├── db/                     # Database layer & domain logic
│   │   ├── core.ts             # SQLite connection, pragmas, schema & migrations
│   │   ├── database.ts         # Business logic (sales, shifts, returns, analytics)
│   │   ├── backup.ts           # Backup creation, restoration, and rotation
│   │   ├── crypto.ts           # Credential encryption
│   │   ├── excelImport.ts      # XLSX product catalog parser
│   │   ├── telegram.ts         # Asynchronous Telegram notification service
│   │   └── types.ts            # Data models and domain interfaces
│   ├── ipc/                    # Modular IPC handlers (auth, sales, printing, etc.)
│   └── server/
│       └── companionServer.ts  # HTTPS/LAN mobile scanner server
├── renderer/                   # React Frontend (Vite)
│   ├── src/
│   │   ├── App.tsx             # Root routing, auth guards & layout shell
│   │   ├── components/         # Modals, forms, tables, and print templates
│   │   ├── contexts/           # Auth, language (Arabic/English), theme & toasts
│   │   ├── hooks/              # Barcode scanner, shortcuts, cart state
│   │   ├── layouts/            # Topbar, sidebar navigation, and layout frame
│   │   ├── pages/              # POS, Products, Returns, Reports, Settings, etc.
│   │   └── types/              # Renderer TypeScript definitions
│   └── index.html              # HTML5 entry point
├── release/                    # Production installer artifacts (.exe)
└── package.json                # Dependencies, build scripts & metadata
```

---

## Technology Stack

- **Runtime & Desktop Shell**: Electron 31
- **UI Framework**: React 18 with TypeScript
- **Bundler & Dev Server**: Vite 5
- **Local Database**: SQLite3 (with WAL mode, foreign keys, synchronous normal)
- **Styling**: Vanilla CSS with custom CSS variable design tokens (dark/light themes, full RTL Arabic support)
- **Icons**: Lucide React
- **Hardware & Peripherals**: Windows Spooler Raw API (`winspool.drv`), PowerShell ESC/POS raw bytes, HTML5 Canvas QR code generator

---

## Getting Started & Development

### Prerequisites
- Node.js 18.x or 20.x
- Windows 10 or 11 (64-bit)
- PowerShell 5.1+ (for cash drawer ESC/POS execution)

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
```
This concurrently starts:
1. Vite dev server on `http://localhost:5174`
2. Electron main process with hot reload

---

## Core Business & Financial Logic

### Session-Based Shift Closing & Z-Report
Unlike basic systems that reset sales calculations at midnight, EVA POS uses continuous session tracking:
- **Boundary Determination**: Shift activity is bounded from the timestamp of the last recorded closing (`closedAt` in `shift_closings`) to the present moment.
- **Late-Night Store Hours**: Transactions occurring past midnight (e.g. 12:02 AM, 1:30 AM, 2:00 AM) remain part of the active shift.
- **Clean Slate on Zero Activity**: If the store closes and no sales, returns, or expenses have occurred since the last closing, opening cash starts at 0 IQD and the header displays `New Shift (0 sales)`.
- **Opening Float Carry-Over**: When transactions exist and the previous closing occurred within 20 hours, the previous shift's `actualCashIQD` is automatically carried over as the starting float. The cashier can also manually adjust this value in the modal.
- **Live Expected Cash Formula**:
  ```
  Expected Cash = Opening Cash + Cash Sales + Mixed Cash Sales + Exchange Cash - Cash Refunds - Expenses
  ```
- **Variance Tracking**: `Difference = Actual Cash - Expected Cash` (positive indicates surplus; negative indicates shortage).

### Sales, Discounts & Cost Tracking
- **Multi-Cart Cashier Profiles**: Up to 4 active carts can be held concurrently (`Alt+1` through `Alt+4`), allowing cashiers to pause a customer's checkout without losing scanned items.
- **Discount Modes**:
  1. `finalPrice`: Cashier sets the total final price (e.g. round down 54,000 to 50,000 IQD). Automatically calculates `subtotal - finalPrice`.
  2. `percent`: Applies a percentage discount across the cart.
  3. `amount`: Direct fixed deduction in IQD.
- **Cost & Profit Snapshot**: At the moment of sale, the USD purchase cost of each variant is multiplied by the active exchange rate and stored in `sale_items.unitCostIQDAtSale`. This creates an immutable historical profit snapshot regardless of future currency rate fluctuations.

### Returns, Exchanges & Stock Direction
- **Full & Partial Returns**: Returns can reference an original `saleId` or be processed as general returns.
- **Exchanges (استبدال)**: An exchange transaction can contain returned items (direction `exchange_out`, increasing stock) and replacement items taken by the customer (direction `exchange_in`, decreasing stock).
- **Financial Balance**: Net difference determines whether the register owes the customer a cash refund or the customer pays an additional balance.
- **Customer Ledger Updates**: `totalSpentIQD` and `loyaltyPoints` on customer profiles automatically adjust based on return/exchange outcomes.

### Dual-Currency System (IQD & USD)
- Wholesale purchase costs and supplier purchase orders are recorded in USD.
- Retail sales, customer debt, expenses, and cash registers operate in IQD.
- Exchange rates are configured in Settings and tracked with effective dates in `exchange_rates`.

---

## Comprehensive System Audit & Issue Log

A full forensic analysis of the application was completed across logic, UI/UX, database queries, and hardware. Below is the itemized report:

### Pillar 1: Financial & Register Logic

#### 1. Mixed Payment (Cash/Card) Accounting Flaw
- **Location**: [PosPage.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/PosPage.tsx#L1215-L1230), [database.ts](file:///c:/Users/PC/Desktop/evabos/electron/db/database.ts#L4066-L4155), [ShiftCloseModal.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/components/ShiftCloseModal.tsx#L168-L171)
- **Problem**: When `paymentMethod = 'mixed'` is selected, the POS does not prompt for individual cash and card amounts. The entire total is recorded as mixed, and `getShiftSummary` treats 100% of the mixed sale total as cash expected in the register drawer.
- **Impact**: If a customer pays 30,000 IQD cash and 70,000 IQD card, the register expects 100,000 IQD in cash, resulting in a false 70,000 IQD drawer shortage at shift close.
- **Remedy**: Add cash/card split inputs to the cart sidebar when mixed payment is selected, store them in the `sales` table, and only add the cash portion to `expectedCashIQD`.

#### 2. UTC vs Local Time Mismatch in Reports & KPIs
- **Location**: [database.ts](file:///c:/Users/PC/Desktop/evabos/electron/db/database.ts#L2871), [database.ts](file:///c:/Users/PC/Desktop/evabos/electron/db/database.ts#L794), [database.ts](file:///c:/Users/PC/Desktop/evabos/electron/db/database.ts#L399)
- **Problem**: Timestamps are stored in UTC ISO format. In Iraq (UTC+3), a sale at 1:30 AM on September 19 has a UTC date of September 18. Queries in `getDashboardKPIs`, `getPeakHoursData`, and `getAdvancedReports` filter with `WHERE date(saleDate) BETWEEN ...` without `'localtime'`.
- **Impact**: Sales occurring past midnight drop off today's dashboard KPIs and are misattributed to yesterday.
- **Remedy**: Update all SQL date filtering to `date(saleDate, 'localtime')` and `date(createdAt, 'localtime')`.

#### 3. Hardcoded `branchId: 1` in Operations Pages
- **Location**: [ExpensesPage.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/ExpensesPage.tsx#L17), [ReturnsPage.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/ReturnsPage.tsx#L42), [PurchaseOrdersPage.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/PurchaseOrdersPage.tsx#L33), [ProductsPage.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/ProductsPage.tsx#L175-L537)
- **Problem**: Default states and adjustment calls hardcode `branchId: 1` rather than pulling `user?.branchId` from auth context.
- **Impact**: In multi-branch stores, actions taken by staff at Branch 2 affect Branch 1's cash drawer and inventory.
- **Remedy**: Pass the active `user?.branchId` across all operational pages.

#### 4. Customer Preset VIP Discount Ignored
- **Location**: [PosPage.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/PosPage.tsx#L1174-L1182), [CustomersPage.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/CustomersPage.tsx#L422)
- **Problem**: Selecting a customer in POS does not inspect `customer.discountPercent`.
- **Impact**: Cashiers must manually calculate or remember VIP customer discounts.
- **Remedy**: Automatically populate `discountMode: 'percent'` and `discountValue: customer.discountPercent` upon customer selection.

#### 5. Online Order Confirmation Bypasses Inventory Audit
- **Location**: [database.ts](file:///c:/Users/PC/Desktop/evabos/electron/db/database.ts#L3436-L3442)
- **Problem**: Confirming an online order executes raw `UPDATE variant_stock` without writing to `inventory_adjustments`.
- **Remedy**: Use `adjustVariantStockInternal` so online deductions appear in inventory audit logs.

---

### Pillar 2: UI / UX & Front-of-House

#### 1. Keyboard Shortcut Leakage Behind Modals
- **Location**: [useShortcutKeys.ts](file:///c:/Users/PC/Desktop/evabos/renderer/src/hooks/useShortcutKeys.ts#L8-L62), [PosPage.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/PosPage.tsx#L871-L893)
- **Problem**: `Control+Enter` (complete sale), `Delete` (remove cart item), and `Alt+1..4` (switch profiles) listen on window without checking if a modal is open.
- **Remedy**: Disable shortcuts when any modal overlay (`showShiftCloseModal`, `printSale`, `customerModal`, etc.) is active.

#### 2. Barcode Scanner Active While Modals Are Open
- **Location**: [useBarcodeScanner.ts](file:///c:/Users/PC/Desktop/evabos/renderer/src/hooks/useBarcodeScanner.ts#L14-L67), [PosPage.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/PosPage.tsx#L856)
- **Problem**: Scanning a barcode while counting cash in shift close or viewing printing options adds items to the background cart.
- **Remedy**: Add an `enabled: boolean` flag to `useBarcodeScanner` and pause it during modal display.

#### 3. Hardcoded English Headers in Receipts & Incorrect A4 Page Size
- **Location**: [PrintingModal.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/components/PrintingModal.tsx#L117-L292), [printing.ts](file:///c:/Users/PC/Desktop/evabos/electron/ipc/printing.ts#L224-L233)
- **Problem**: Receipt tables use hardcoded English headers (`Item`, `Qty`, `Price`, `Total`). In `generateInvoiceHtml`, `@page { size: 80mm auto; }` is hardcoded for A4 invoices, and Electron is not passed `pageSize: 'A4'`, causing desktop printers to receive 72mm roll dimensions.
- **Remedy**: Localize receipt headers, apply `'Cairo', 'Segoe UI', Tahoma, sans-serif` font styling, and pass `pageSize: 'A4'` when printing invoices.

#### 4. Responsive Layout on 1366x768 POS Displays
- **Location**: [PosPage.css](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/PosPage.css#L14-L49)
- **Problem**: Fixed height `calc(100vh - 120px)` and unconstrained sidebar content pushes the checkout button below the fold on standard 768p POS touchscreens.
- **Remedy**: Add compact styling and `@media (max-height: 800px)` rules to ensure the entire checkout flow fits without scrolling.

#### 5. Eastern Arabic Numerals Rejection
- **Location**: [NumberInput.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/components/NumberInput.tsx), [CalculatorInput.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/components/CalculatorInput.tsx#L46)
- **Problem**: When typing on an Arabic keyboard layout, Eastern numerals (`٠١٢٣٤٥٦٧٨٩`) are rejected by HTML5 number inputs and calculator regex.
- **Remedy**: Sanitize input by converting Eastern Arabic numerals to standard digits (`0-9`) prior to validation.

#### 6. Emoji Scrub in Legal Modal
- **Location**: [LegalAcceptanceModal.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/components/LegalAcceptanceModal.tsx#L89)
- **Problem**: Line 89 contains `⬇️ يرجى التمرير للأسفل للموافقة`.
- **Remedy**: Replace with clean text or a Lucide icon.

---

### Pillar 3: Performance, Database & Scalability

#### 1. Missing Composite SQLite Database Indexes
- **Location**: [core.ts](file:///c:/Users/PC/Desktop/evabos/electron/db/core.ts#L176-L189)
- **Problem**: Current schema lacks composite indexes for multi-column queries executed during shift closing and reporting.
- **Remedy**: Add the following indexes to `createTables()`:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branchId, saleDate);
  CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON expenses(branchId, expenseDate);
  CREATE INDEX IF NOT EXISTS idx_returns_branch_date ON returns(branchId, createdAt);
  CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_lookup ON inventory_adjustments(variantId, branchId);
  CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(productId);
  ```

#### 2. Excel Import Without Transaction Wrapping
- **Location**: [excelImport.ts](file:///c:/Users/PC/Desktop/evabos/electron/db/excelImport.ts#L111-L151)
- **Problem**: `importProductsFromExcel` inserts products, variants, and stock adjustments row by row without an enclosing transaction.
- **Impact**: Importing 500 products executes approximately 2,000 disk writes, taking 30–60 seconds and freezing the UI.
- **Remedy**: Wrap the import loop in `BEGIN TRANSACTION` and `COMMIT` to complete 500-item imports in under 1 second.

#### 3. Multi-Branch Stock Summation in Catalog Listing
- **Location**: [database.ts](file:///c:/Users/PC/Desktop/evabos/electron/db/database.ts#L230)
- **Problem**: `listProducts` sums `vs.quantity` across all branches without filtering by `branchId`.
- **Impact**: POS displays total enterprise inventory rather than stock physically present in the active branch.
- **Remedy**: Add `branchId` parameter to `PaginationParams` and filter `vs.branchId` in the query join.

---

### Pillar 4: Security, Access Control & Reliability

#### 1. Profit Margin Exposure to Cashiers
- **Location**: [SalesHistoryPage.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/SalesHistoryPage.tsx#L254-L294), [SalesHistoryPage.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/SalesHistoryPage.tsx#L673)
- **Problem**: [SalesHistoryPage.tsx](file:///c:/Users/PC/Desktop/evabos/renderer/src/pages/SalesHistoryPage.tsx) displays `profitIQD` and total store profit without verifying `user.role`.
- **Impact**: Cashiers can see wholesale costs and net margins on all products.
- **Remedy**: Restrict profit columns and summary cards to `admin` and `manager` roles.

#### 2. Unauthenticated Companion Scanner LAN Access
- **Location**: [companionServer.ts](file:///c:/Users/PC/Desktop/evabos/electron/server/companionServer.ts#L186-L320)
- **Problem**: The companion server runs on port 8989 across the local LAN without authentication, exposing purchase costs, multipliers, and margins to anyone on the Wi-Fi.
- **Remedy**: Protect endpoints with a manager pairing PIN or session token.

#### 3. Activity Audit Gaps in Expense Management
- **Location**: [expenses.ts](file:///c:/Users/PC/Desktop/evabos/electron/ipc/expenses.ts#L27-L42)
- **Problem**: Creating or deleting expenses does not log an entry in `activity_logs`.
- **Remedy**: Add `logActivity` calls to expense creation and deletion handlers.

---

## Prioritized Roadmap Matrix

| Priority | Category | Task | Impact | Complexity |
|---|---|---|---|---|
| **P1** | Accounting | Mixed Payment Split (Cash/Card) | Eliminates false cash drawer shortages | Low |
| **P1** | Accounting | Add `'localtime'` to SQL Reports & KPIs | Fixes late-night sales date attribution | Low |
| **P1** | Accounting | Dynamic User `branchId` in Expenses & Returns | Prevents cross-branch financial corruption | Low |
| **P1** | Security | Hide Profit/Margins from Cashier Role | Protects sensitive wholesale pricing | Low |
| **P2** | Performance | Add Composite SQLite Indexes | Accelerates shift & report queries | Very Low |
| **P2** | Performance | Wrap Excel Product Import in Transaction | Reduces import time from 60s to <1s | Low |
| **P2** | Hardware | Correct A4 Page Size in Print IPC & CSS | Fixes distorted A4 invoice printing | Low |
| **P2** | UI / UX | Pause Shortcuts & Scanner in Modals | Prevents background cart corruption | Medium |
| **P3** | UI / UX | 768p POS Screen Compact Layout | Eliminates sidebar scrolling on touchscreens | Medium |
| **P3** | UI / UX | Sanitize Eastern Arabic Numerals | Smooth numeric entry for Arabic cashiers | Low |
| **P3** | UI / UX | Auto-Apply Customer VIP Discount | Seamless loyalty discounts at checkout | Low |
| **P3** | UI / UX | Remove Remaining Emoji in Legal Modal | Maintains clean interface standards | Very Low |

---

## Build & Packaging

### Production Bundle
```bash
npm run build
```
This script:
1. Compiles the React application with Vite into `dist/`
2. Transpiles Electron main process and IPC TypeScript files into `dist-electron/`

### Windows Installer Generation
```bash
npm run build:win
```
Generates a portable executable and standalone Windows NSIS setup package in `release/`:
- `release/EVA POS-6.0.0-Setup.exe`

---

## License

Proprietary — All rights reserved.
