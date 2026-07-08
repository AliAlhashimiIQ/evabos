/**
 * database.ts â€” Barrel module that re-exports shared utilities from core.ts
 * and contains all domain business logic.
 *
 * All IPC handlers import from this file. The shared DB primitives now live in core.ts.
 */
import crypto from 'crypto';
import log from 'electron-log';

// Re-export core utilities (barrel pattern - all IPC handlers import from this file)
export { initDatabase, closeDatabase, getSetting, setSetting, getAllSettings,
  ensureVariantStockRow, mapSaleItemRow,
} from './core';
export type { SettingRow, ProductVariantRow } from './core';

// Import core utilities for use in domain functions below
import {
  run, runWithResult, get, all,
  hashPassword, verifyPassword,
  generateSku, generateBarcode,
  ensureVariantStockRow, adjustVariantStockInternal,
  mapVariantRow, mapSaleRow, mapSaleItemRow, mapExchangeRateRow,
} from './core';
import type { SqlValue, ProductVariantRow } from './core';

import {
  DateRange,
  ExchangeRate,
  ExchangeRateInput,
  ExchangeRateResponse,
  InventoryAdjustment,
  Product,
  ProductInput,
  ProductsListResponse,
  Sale,
  SaleItem,
  SaleInput,
  SalesListResponse,
  Supplier,
  SupplierInput,
  PurchaseOrderInput,
  PurchaseOrderWithItems,
  PurchaseOrderReceiveInput,
  PurchaseOrderItem,
  Customer,
  CustomerInput,
  CustomerUpdateInput,
  CustomerHistoryEntry,
  ReturnInput,
  ReturnResponse,
  ReturnRecord,
  ReturnItem,
  Expense,
  ExpenseInput,
  ExpenseSummary,
  AdvancedReports,
  DailySalesEntry,
  NamedMetric,
  ExpensesVsSalesEntry,
  ActivityLogEntry,
  UserSession,
  LoginResponse,
  User,
  UserInput,
  UserUpdateInput,
  Branch,
  BranchInput,
  BranchUpdateInput,
  ProductUpdateInput,
  VariantUpdateInput,
  SaleDetail,
  SaleDetailItem,
  DashboardKPIs,
  PaginationParams,
  PaginatedResponse,
  OnlineOrder,
  OnlineOrderInput,
  OnlineOrderItem,
  Employee,
  EmployeeInput,
} from './types';

// â”€â”€â”€ Session State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const activeSessions = new Map<string, UserSession>();
let posLocked = false;
let posLockedBy: number | null = null;

// â”€â”€â”€ Internal Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const fetchCustomerById = async (id: number): Promise<Customer | null> => {
  const result = await get<Customer>('SELECT * FROM customers WHERE id = ?', [id]);
  return result ?? null;
};


// â”€â”€â”€ Domain Business Logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€




// ─── Domain Business Logic ────────────────────────────────────────────────────

export async function getSaleDetail(saleId: number): Promise<SaleDetail | null> {
  const sale = await get<any>(
    `
    SELECT s.*, e.name AS employeeName
    FROM sales s
    LEFT JOIN employees e ON e.id = s.employeeId
    WHERE s.id = ?
    `,
    [saleId],
  );

  if (!sale) {
    return null;
  }

  const items = await all<SaleDetailItem>(
    `
    SELECT
      si.*,
      p.name AS productName,
      pv.color,
      pv.size
    FROM sale_items si
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    WHERE si.saleId = ?
  `,
    [saleId],
  );

  return {
    ...sale,
    items,
  };
}


// adjustVariantStock is the public API wrapper - re-exported from core
export async function adjustVariantStock(args: {
  variantId: number;
  branchId: number;
  deltaQuantity: number;
  reason: string;
  note?: string;
  adjustedBy?: number | null;
}): Promise<InventoryAdjustment> {
  return adjustVariantStockInternal(
    args.variantId,
    args.branchId,
    args.deltaQuantity,
    args.reason,
    args.note,
    args.adjustedBy,
  );
}

// Product count cache
let productCountCache: { count: number; timestamp: number } | null = null;

export async function getProductCount(): Promise<number> {
  const now = Date.now();
  const CACHE_TTL = 60000; // 1 minute

  if (productCountCache && (now - productCountCache.timestamp) < CACHE_TTL) {
    return productCountCache.count;
  }

  const result = await get<{ count: number }>(
    'SELECT COUNT(*) as count FROM product_variants'
  );

  const count = result?.count ?? 0;
  productCountCache = { count, timestamp: now };

  return count;
}

export async function listProducts(
  params: PaginationParams = {}
): Promise<PaginatedResponse<Product>> {
  const limit = params.limit ?? 100;
  const cursor = params.cursor ?? 0;
  const search = params.search?.toLowerCase().trim() ?? '';

  const whereClause = search
    ? `AND (
        LOWER(p.name) LIKE ? OR 
        LOWER(pv.sku) LIKE ? OR 
        LOWER(pv.barcode) LIKE ? OR
        LOWER(p.category) LIKE ?
      )`
    : '';

  // For descending order, if cursor is 0 (first page), start from MAX ID.
  // Otherwise, select ids less than the cursor.
  const cursorVal = cursor > 0 ? cursor : 2147483647;

  const searchParam = `%${search}%`;
  const queryParams: SqlValue[] = search
    ? [cursorVal, searchParam, searchParam, searchParam, searchParam, limit + 1]
    : [cursorVal, limit + 1];

  const rows = await all<ProductVariantRow>(
    `
    SELECT
      pv.id AS variantId,
      pv.productId,
      p.name AS productName,
      p.category,
      p.season,
      p.baseCode,
      s.name AS supplierName,
      pv.size,
      pv.color,
      pv.sku,
      pv.barcode,
      pv.defaultPriceIQD,
      pv.purchaseCostUSD,
      pv.avgCostUSD,
      pv.lastPurchaseCostUSD,
      pv.isActive as variantActive,
      IFNULL(SUM(vs.quantity), 0) AS stockOnHand
    FROM product_variants pv
    JOIN products p ON p.id = pv.productId
    LEFT JOIN suppliers s ON s.id = p.defaultSupplierId
    LEFT JOIN variant_stock vs ON vs.variantId = pv.id
    WHERE pv.id < ? ${whereClause}
    GROUP BY pv.id
    ORDER BY pv.id DESC
    LIMIT ?
  `,
    queryParams
  );

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].variantId : null;

  return {
    items: items.map(mapVariantRow),
    nextCursor,
    hasMore,
  };
}

// Legacy function for backward compatibility
export async function listProductsLegacy(): Promise<ProductsListResponse> {
  const result = await listProducts({ limit: 10000 }); // Load all
  return { products: result.items };
}

export async function listSuppliers(): Promise<Supplier[]> {
  return all<Supplier>(
    `
    SELECT *
    FROM suppliers
    ORDER BY name ASC
  `,
  );
}

export async function getUniqueSeasons(): Promise<string[]> {
  const rows = await all<{ season: string }>(
    `SELECT DISTINCT season FROM products WHERE season IS NOT NULL AND season != '' ORDER BY season ASC`
  );
  return rows.map(r => r.season);
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const result = await runWithResult(
    `
    INSERT INTO suppliers (name, contactName, phone, email, address, notes, isActive)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    [
      input.name,
      input.contactName ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.address ?? null,
      input.notes ?? null,
      (input.isActive ?? true) ? 1 : 0,
    ],
  );

  return {
    id: result.lastID as number,
    name: input.name,
    contactName: input.contactName ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null,
    isActive: input.isActive ?? true,
  };
}

export async function listCustomers(): Promise<Customer[]> {
  return all<Customer>(
    `
    SELECT *
    FROM customers
    ORDER BY name ASC
  `,
  );
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const result = await runWithResult(
    `
    INSERT INTO customers (name, phone, notes, totalVisits, totalSpentIQD, loyaltyPoints, discountPercent)
    VALUES (?, ?, ?, 0, 0, 0, ?)
  `,
    [input.name, input.phone ?? null, input.notes ?? null, input.discountPercent ?? null],
  );

  const created = await fetchCustomerById(result.lastID as number);
  if (!created) {
    throw new Error('Failed to load created customer');
  }
  return created;
}

export async function updateCustomer(input: CustomerUpdateInput): Promise<Customer> {
  const existing = await fetchCustomerById(input.id);
  if (!existing) {
    throw new Error('Customer not found');
  }

  await run(
    `
    UPDATE customers
    SET name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        notes = COALESCE(?, notes),
        discountPercent = COALESCE(?, discountPercent)
    WHERE id = ?
  `,
    [input.name ?? null, input.phone ?? null, input.notes ?? null, input.discountPercent ?? null, input.id],
  );

  const updated = await fetchCustomerById(input.id);
  if (!updated) {
    throw new Error('Failed to load updated customer');
  }

  return updated;
}



export async function getAdvancedReports(range: DateRange): Promise<AdvancedReports> {
  const seasonFilter = range.season ? ' AND p.season = ? ' : '';
  const seasonParam = range.season ? [range.season] : [];

  const returnsSummaryRow = await get<{ count: number; totalRefund: number; totalReturnCost: number }>(
    `
    SELECT 
      COUNT(*) as count,
      IFNULL(SUM(refundAmountIQD), 0) as totalRefund,
      IFNULL(SUM(totalCostIQD), 0) as totalReturnCost
    FROM returns
    WHERE date(createdAt) BETWEEN date(?) AND date(?)
  `,
    [range.startDate, range.endDate],
  );

  const returnedItemsCountRow = await get<{ count: number }>(
    `
    SELECT IFNULL(SUM(ri.quantity), 0) as count
    FROM return_items ri
    JOIN returns r ON r.id = ri.returnId
    WHERE date(r.createdAt) BETWEEN date(?) AND date(?)
    `,
    [range.startDate, range.endDate]
  );

  const totalReturns = returnsSummaryRow?.totalRefund ?? 0;
  const totalReturnCost = returnsSummaryRow?.totalReturnCost ?? 0;
  const totalItemsReturned = returnedItemsCountRow?.count ?? 0;

  const dailySales = await all<DailySalesEntry>(
    `
    WITH daily_sales AS (
      SELECT
        date(s.saleDate) as date,
        IFNULL(SUM(s.totalIQD), 0) as grossIQD,
        COUNT(*) as orders
      FROM sales s
      WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
      GROUP BY date(s.saleDate)
    ),
    daily_cost AS (
      SELECT
        date(s.saleDate) as date,
        IFNULL(SUM(s.totalIQD - IFNULL(s.profitIQD, 0)), 0) as costIQD
      FROM sales s
      WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
      GROUP BY date(s.saleDate)
    ),
    daily_items AS (
      SELECT
        date(s.saleDate) as date,
        IFNULL(SUM(si.quantity), 0) as itemsSold
      FROM sale_items si
      JOIN sales s ON s.id = si.saleId
      WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
      GROUP BY date(s.saleDate)
    ),
    daily_returns AS (
      SELECT
        date(createdAt) as date,
        IFNULL(SUM(refundAmountIQD), 0) as returnedIQD
      FROM returns
      WHERE date(createdAt) BETWEEN date(?) AND date(?)
      GROUP BY date(createdAt)
    ),
    all_dates AS (
      SELECT date FROM daily_sales
      UNION
      SELECT date FROM daily_returns
    )
    SELECT
      ad.date,
      IFNULL(ds.grossIQD, 0) - IFNULL(dr.returnedIQD, 0) as totalIQD,
      IFNULL(ds.orders, 0) as orders,
      IFNULL(di.itemsSold, 0) as itemsSold,
      IFNULL(dc.costIQD, 0) as costIQD,
      CASE WHEN IFNULL(ds.orders, 0) = 0 THEN 0 ELSE (IFNULL(ds.grossIQD, 0) - IFNULL(dr.returnedIQD, 0)) / ds.orders END as avgTicket
    FROM all_dates ad
    LEFT JOIN daily_sales ds ON ds.date = ad.date
    LEFT JOIN daily_cost dc ON dc.date = ad.date
    LEFT JOIN daily_items di ON di.date = ad.date
    LEFT JOIN daily_returns dr ON dr.date = ad.date
    ORDER BY ad.date
  `,
    [range.startDate, range.endDate, range.startDate, range.endDate, range.startDate, range.endDate, range.startDate, range.endDate],
  );

  const bestSellingItems = await all<NamedMetric>(
    `
    SELECT
      p.name as name,
      IFNULL(SUM(si.quantity), 0) as quantity,
      IFNULL(SUM(si.lineTotalIQD), 0) as amountIQD
    FROM sale_items si
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    JOIN sales s ON s.id = si.saleId
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
    ${seasonFilter}
    GROUP BY p.name
    ORDER BY quantity DESC
    LIMIT 10
  `,
    [range.startDate, range.endDate, ...seasonParam],
  );

  const salesBySize = await all<NamedMetric>(
    `
    SELECT
      COALESCE(pv.size, 'Unknown') as name,
      IFNULL(SUM(si.quantity), 0) as quantity,
      IFNULL(SUM(si.lineTotalIQD), 0) as amountIQD
    FROM sale_items si
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    JOIN sales s ON s.id = si.saleId
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
    ${seasonFilter}
    GROUP BY pv.size
  `,
    [range.startDate, range.endDate, ...seasonParam],
  );

  const salesByColor = await all<NamedMetric>(
    `
    SELECT
      COALESCE(pv.color, 'Unknown') as name,
      IFNULL(SUM(si.quantity), 0) as quantity,
      IFNULL(SUM(si.lineTotalIQD), 0) as amountIQD
    FROM sale_items si
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    JOIN sales s ON s.id = si.saleId
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
    ${seasonFilter}
    GROUP BY pv.color
  `,
    [range.startDate, range.endDate, ...seasonParam],
  );

  const topCustomers = await all<NamedMetric>(
    `
    SELECT
      COALESCE(c.name, 'Walk-in') as name,
      COUNT(s.id) as quantity,
      IFNULL(SUM(s.totalIQD), 0) as amountIQD
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customerId
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
    GROUP BY c.id
    ORDER BY amountIQD DESC
    LIMIT 10
  `,
    [range.startDate, range.endDate],
  );

  const grossRevenueRow = await get<{ revenue: number }>(
    `
    SELECT IFNULL(SUM(s.totalIQD), 0) as revenue
    FROM sales s
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
  `,
    [range.startDate, range.endDate],
  );

  const grossCostRow = await get<{ cost: number }>(
    `
    SELECT IFNULL(SUM(s.totalIQD - IFNULL(s.profitIQD, 0)), 0) as cost
    FROM sales s
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
  `,
    [range.startDate, range.endDate],
  );

  const grossItemsSoldRow = await get<{ count: number }>(
    `
    SELECT IFNULL(SUM(si.quantity), 0) as count
    FROM sale_items si
    JOIN sales s ON s.id = si.saleId
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
    ${seasonFilter}
    `,
    [range.startDate, range.endDate, ...seasonParam]
  );

  const expensesRow = await get<{ total: number }>(
    `
    SELECT IFNULL(SUM(amountIQD), 0) as total
    FROM expenses
    WHERE date(expenseDate) BETWEEN date(?) AND date(?)
  `,
    [range.startDate, range.endDate],
  );

  const currentRateObj = await getCurrentExchangeRate();
  const currentRate = currentRateObj?.currentRate?.rate ?? 1500;

  const inventoryValueRow = await get<{ value: number }>(
    `
    SELECT IFNULL(SUM(vs.quantity * pv.avgCostUSD * ?), 0) as value
    FROM variant_stock vs
    JOIN product_variants pv ON pv.id = vs.variantId
    JOIN products p ON p.id = pv.productId
    WHERE p.isActive = 1 AND pv.isActive = 1
    ${seasonFilter}
  `,
    [currentRate, ...seasonParam],
  );

  // Calculate total cost of all items ever sold
  const totalSoldCostRow = await get<{ totalCost: number }>(
    `
    SELECT IFNULL(SUM(si.quantity * IFNULL(si.unitCostIQDAtSale, 0)), 0) as totalCost
    FROM sale_items si
    JOIN sales s ON s.id = si.saleId
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    WHERE 1=1 ${seasonFilter}
    `,
    [...seasonParam]
  );

  const totalInventoryValueIncludingSoldIQD = (inventoryValueRow?.value || 0) + (totalSoldCostRow?.totalCost || 0);

  const totalStockCountRow = await get<{ count: number }>(
    `
    SELECT IFNULL(SUM(quantity), 0) as count
    FROM variant_stock vs
    JOIN product_variants pv ON pv.id = vs.variantId
    JOIN products p ON p.id = pv.productId
    WHERE p.isActive = 1 AND pv.isActive = 1
    ${seasonFilter}
    `,
    [...seasonParam]
  );

  const lowStock = await all<{ sku: string; productName: string; color?: string; size?: string; quantity: number }>(
    `
    SELECT
      pv.sku,
      p.name AS productName,
      pv.color,
      pv.size,
      vs.quantity
    FROM variant_stock vs
    JOIN product_variants pv ON pv.id = vs.variantId
    JOIN products p ON p.id = pv.productId
    WHERE vs.quantity <= vs.lowStockThreshold
    ${seasonFilter}
    ORDER BY vs.quantity ASC
    LIMIT 20
  `,
    [...seasonParam]
  );

  const expensesVsSales = await all<ExpensesVsSalesEntry>(
    `
    WITH sales_data AS (
      SELECT date(saleDate) AS date, IFNULL(SUM(totalIQD), 0) AS salesIQD
      FROM sales
      WHERE date(saleDate) BETWEEN date(?) AND date(?)
      GROUP BY date(saleDate)
    ),
    expense_data AS (
      SELECT date(expenseDate) AS date, IFNULL(SUM(amountIQD), 0) AS expensesIQD
      FROM expenses
      WHERE date(expenseDate) BETWEEN date(?) AND date(?)
      GROUP BY date(expenseDate)
    ),
    days AS (
      SELECT date FROM sales_data
      UNION
      SELECT date FROM expense_data
    )
    SELECT
      days.date AS date,
      IFNULL(sales_data.salesIQD, 0) AS salesIQD,
      IFNULL(expense_data.expensesIQD, 0) AS expensesIQD
    FROM days
    LEFT JOIN sales_data ON sales_data.date = days.date
    LEFT JOIN expense_data ON expense_data.date = days.date
    ORDER BY days.date
  `,
    [range.startDate, range.endDate, range.startDate, range.endDate],
  );

  const activityLogs = await all<ActivityLogEntry>(
    `
    SELECT id, userId, action, entity, entityId, createdAt
    FROM activity_logs
    ORDER BY datetime(createdAt) DESC
    LIMIT 50
  `,
  );

  const inventoryBySupplier = await all<{ supplierName: string; totalQuantity: number; totalValueUSD: number; soldQuantity: number; totalSoldValueUSD: number }>(
    `
    SELECT
      COALESCE(s.name, 'No Supplier') as supplierName,
      IFNULL(SUM(vs.quantity), 0) as totalQuantity,
      IFNULL(SUM(vs.quantity * pv.avgCostUSD), 0) as totalValueUSD,
      (
        SELECT IFNULL(SUM(si.quantity), 0)
        FROM sale_items si
        JOIN product_variants pv2 ON pv2.id = si.variantId
        JOIN products p2 ON p2.id = pv2.productId
        WHERE p2.defaultSupplierId = p.defaultSupplierId ${seasonFilter.replace(/p\./g, 'p2.')}
      ) as soldQuantity,
      (
        SELECT IFNULL(SUM(si.quantity * pv2.avgCostUSD), 0)
        FROM sale_items si
        JOIN product_variants pv2 ON pv2.id = si.variantId
        JOIN products p2 ON p2.id = pv2.productId
        WHERE p2.defaultSupplierId = p.defaultSupplierId ${seasonFilter.replace(/p\./g, 'p2.')}
      ) as totalSoldValueUSD
    FROM variant_stock vs
    JOIN product_variants pv ON pv.id = vs.variantId
    JOIN products p ON p.id = pv.productId
    LEFT JOIN suppliers s ON s.id = p.defaultSupplierId
    WHERE p.isActive = 1 AND pv.isActive = 1
    ${seasonFilter}
    GROUP BY p.defaultSupplierId
    ORDER BY totalValueUSD DESC
  `,
    [...seasonParam, ...seasonParam, ...seasonParam]
  );

  const revenue = (grossRevenueRow?.revenue ?? 0) - totalReturns;
  const cost = (grossCostRow?.cost ?? 0) - totalReturnCost;
  const expenses = expensesRow?.total ?? 0;
  const netProfit = revenue - cost - expenses;
  const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const totalItemsSold = (grossItemsSoldRow?.count ?? 0) - totalItemsReturned;

  return {
    dailySales,
    bestSellingItems,
    salesBySize,
    salesByColor,
    topCustomers,
    profitAnalysis: {
      revenueIQD: revenue,
      costIQD: cost,
      expensesIQD: expenses,
      netProfitIQD: netProfit,
      profitMarginPercent: Math.round(profitMargin * 10) / 10,
    },
    inventoryValue: inventoryValueRow?.value ?? 0,
    lowStock,
    expensesVsSales,
    activityLogs,
    inventoryBySupplier,
    returnsSummary: {
      count: returnsSummaryRow?.count ?? 0,
      totalIQD: totalReturns,
    },
    totalInventoryValueIncludingSoldIQD,
    totalItemsInStock: totalStockCountRow?.count || 0,
    totalItemsSold: totalItemsSold,
  };
}

// Expense breakdown by category for the Financial tab
export async function getExpensesByCategory(
  startDate: string,
  endDate: string
): Promise<Array<{ category: string; totalIQD: number; count: number }>> {
  return all<{ category: string; totalIQD: number; count: number }>(
    `
    SELECT
      category,
      IFNULL(SUM(amountIQD), 0) as totalIQD,
      COUNT(*) as count
    FROM expenses
    WHERE date(expenseDate) BETWEEN date(?) AND date(?)
    GROUP BY category
    ORDER BY totalIQD DESC
    `,
    [startDate, endDate]
  );
}

// Sales grouped by season for the Season Analysis
export async function getSalesBySeason(
  startDate: string,
  endDate: string
): Promise<Array<{ season: string; quantity: number; revenueIQD: number; profitIQD: number; itemCount: number }>> {
  const rows = await all<{ season: string; quantity: number; revenueIQD: number; costIQD: number; itemCount: number }>(
    `
    SELECT
      COALESCE(p.season, 'بدون موسم') as season,
      IFNULL(SUM(si.quantity), 0) as quantity,
      IFNULL(SUM(si.lineTotalIQD), 0) as revenueIQD,
      IFNULL(SUM(si.quantity * IFNULL(si.unitCostIQDAtSale, 0)), 0) as costIQD,
      COUNT(DISTINCT p.id) as itemCount
    FROM sale_items si
    JOIN sales s ON s.id = si.saleId
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
    GROUP BY p.season
    ORDER BY revenueIQD DESC
    `,
    [startDate, endDate]
  );
  return rows.map(r => ({
    season: r.season,
    quantity: r.quantity,
    revenueIQD: r.revenueIQD,
    profitIQD: r.revenueIQD - r.costIQD,
    itemCount: r.itemCount,
  }));
}

// Peak Hours Analytics - Get sales count and revenue by hour of day
export async function getPeakHoursData(
  startDate: string,
  endDate: string,
  branchId?: number
): Promise<Array<{ hour: number; saleCount: number; totalSalesIQD: number }>> {
  const branchFilter = branchId ? 'AND branchId = ?' : '';
  const params = branchId ? [startDate, endDate, branchId] : [startDate, endDate];

  const rows = await all<{ hour: string; saleCount: number; totalSalesIQD: number }>(
    `
    SELECT 
      strftime('%H', datetime(saleDate, 'localtime')) as hour,
      COUNT(*) as saleCount,
      IFNULL(SUM(totalIQD), 0) as totalSalesIQD
    FROM sales
    WHERE date(saleDate) BETWEEN date(?) AND date(?) ${branchFilter}
    GROUP BY hour
    ORDER BY hour
    `,
    params
  );

  // Fill in missing hours with zeros (0-23)
  const hourMap = new Map(rows.map(r => [parseInt(r.hour, 10), r]));
  const result: Array<{ hour: number; saleCount: number; totalSalesIQD: number }> = [];
  for (let h = 0; h < 24; h++) {
    const data = hourMap.get(h);
    result.push({
      hour: h,
      saleCount: data?.saleCount || 0,
      totalSalesIQD: data?.totalSalesIQD || 0,
    });
  }
  return result;
}

// Peak Days Analytics - Get sales count and revenue by day of week
export async function getPeakDaysData(
  startDate: string,
  endDate: string,
  branchId?: number
): Promise<Array<{ dayOfWeek: number; dayName: string; saleCount: number; totalSalesIQD: number }>> {
  const branchFilter = branchId ? 'AND branchId = ?' : '';
  const params = branchId ? [startDate, endDate, branchId] : [startDate, endDate];

  const rows = await all<{ dayOfWeek: string; saleCount: number; totalSalesIQD: number }>(
    `
    SELECT 
      strftime('%w', datetime(saleDate, 'localtime')) as dayOfWeek,
      COUNT(*) as saleCount,
      IFNULL(SUM(totalIQD), 0) as totalSalesIQD
    FROM sales
    WHERE date(saleDate) BETWEEN date(?) AND date(?) ${branchFilter}
    GROUP BY dayOfWeek
    ORDER BY dayOfWeek
    `,
    params
  );

  // Day names (0=Sunday, 1=Monday, ...)
  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  // Fill in missing days with zeros
  const dayMap = new Map(rows.map(r => [parseInt(r.dayOfWeek, 10), r]));
  const result: Array<{ dayOfWeek: number; dayName: string; saleCount: number; totalSalesIQD: number }> = [];
  for (let d = 0; d < 7; d++) {
    const data = dayMap.get(d);
    result.push({
      dayOfWeek: d,
      dayName: dayNames[d],
      saleCount: data?.saleCount || 0,
      totalSalesIQD: data?.totalSalesIQD || 0,
    });
  }
  return result;
}

// Least Profitable Items - Items with lowest profit margin
export async function getLeastProfitableItems(
  startDate: string,
  endDate: string,
  exchangeRate: number = 1500,
  limit: number = 20,
  season?: string | null
): Promise<Array<{
  productName: string;
  sku: string;
  color: string | null;
  size: string | null;
  totalSold: number;
  revenueIQD: number;
  costIQD: number;
  profitIQD: number;
  marginPercent: number;
}>> {
  const seasonFilter = season ? ' AND p.season = ? ' : '';
  const seasonParam = season ? [season] : [];

  const rows = await all<{
    productName: string;
    sku: string;
    color: string | null;
    size: string | null;
    totalSold: number;
    revenueIQD: number;
    costIQD: number;
    profitIQD: number;
    marginPercent: number;
  }>(
    `
    SELECT 
      p.name as productName,
      pv.sku,
      pv.color,
      pv.size,
      SUM(si.quantity) as totalSold,
      SUM(si.lineTotalIQD) as revenueIQD,
      SUM(si.quantity * pv.avgCostUSD * ?) as costIQD,
      SUM(si.lineTotalIQD) - SUM(si.quantity * pv.avgCostUSD * ?) as profitIQD,
      ROUND((SUM(si.lineTotalIQD) - SUM(si.quantity * pv.avgCostUSD * ?)) * 100.0 / NULLIF(SUM(si.lineTotalIQD), 0), 1) as marginPercent
    FROM sale_items si
    JOIN sales s ON s.id = si.saleId
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
    ${seasonFilter}
    GROUP BY pv.id
    HAVING totalSold > 0
    ORDER BY marginPercent ASC
    LIMIT ?
    `,
    [exchangeRate, exchangeRate, exchangeRate, startDate, endDate, ...seasonParam, limit]
  );
  return rows;
}

export async function getLeastProfitableSuppliers(
  startDate: string,
  endDate: string,
  exchangeRate: number = 1500,
  season?: string | null
): Promise<Array<{
  supplierName: string;
  totalSold: number;
  revenueIQD: number;
  costIQD: number;
  profitIQD: number;
  marginPercent: number;
}>> {
  const seasonFilter = season ? ' AND p.season = ? ' : '';
  const seasonParam = season ? [season] : [];

  const rows = await all<{
    supplierName: string;
    totalSold: number;
    revenueIQD: number;
    costIQD: number;
    profitIQD: number;
    marginPercent: number;
  }>(
    `
    SELECT 
      IFNULL(sup.name, 'No Supplier') as supplierName,
      SUM(si.quantity) as totalSold,
      SUM(si.lineTotalIQD) as revenueIQD,
      SUM(si.quantity * pv.avgCostUSD * ?) as costIQD,
      SUM(si.lineTotalIQD) - SUM(si.quantity * pv.avgCostUSD * ?) as profitIQD,
      ROUND((SUM(si.lineTotalIQD) - SUM(si.quantity * pv.avgCostUSD * ?)) * 100.0 / NULLIF(SUM(si.lineTotalIQD), 0), 1) as marginPercent
    FROM sale_items si
    JOIN sales s ON s.id = si.saleId
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    LEFT JOIN suppliers sup ON sup.id = p.defaultSupplierId
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
    ${seasonFilter}
    GROUP BY p.defaultSupplierId
    HAVING totalSold > 0
    ORDER BY marginPercent ASC
    `,
    [exchangeRate, exchangeRate, exchangeRate, startDate, endDate, ...seasonParam]
  );
  return rows;
}

export async function getInventoryAging(
  limit: number = 50,
  season?: string | null
): Promise<Array<{
  productName: string;
  sku: string;
  color: string | null;
  size: string | null;
  currentStock: number;
  costUSD: number;
  totalValueUSD: number;
  daysInStock: number;
  lastSoldAt: string | null;
}>> {
  const seasonFilter = season ? ' AND p.season = ? ' : '';
  const seasonParam = season ? [season] : [];

  const rows = await all<{
    productName: string;
    sku: string;
    color: string | null;
    size: string | null;
    currentStock: number;
    costUSD: number;
    totalValueUSD: number;
    daysInStock: number;
    lastSoldAt: string | null;
  }>(
    `SELECT 
      p.name as productName,
      pv.sku,
      pv.color,
      pv.size,
      SUM(vs.quantity) as currentStock,
      pv.avgCostUSD as costUSD,
      SUM(vs.quantity) * pv.avgCostUSD as totalValueUSD,
      COALESCE(CAST(JULIANDAY('now') - JULIANDAY(
        (SELECT MAX(s.saleDate) FROM sales s 
         JOIN sale_items si ON si.saleId = s.id 
         WHERE si.variantId = pv.id)
      ) AS INTEGER), 999) as daysInStock,
      (SELECT MAX(s.saleDate) FROM sales s 
       JOIN sale_items si ON si.saleId = s.id 
       WHERE si.variantId = pv.id) as lastSoldAt
    FROM variant_stock vs
    JOIN product_variants pv ON pv.id = vs.variantId
    JOIN products p ON p.id = pv.productId
    WHERE vs.quantity > 0 AND p.isActive = 1 AND pv.isActive = 1
    ${seasonFilter}
    GROUP BY pv.id
    ORDER BY daysInStock DESC
    LIMIT ?`,
    [...seasonParam, limit]
  );
  return rows;
}

// List all items sold on a specific date (for email reports)
export async function listSaleItems(dateStr: string): Promise<Array<{ name: string; size?: string; color?: string; quantity: number }>> {
  const items = await all<{ name: string; size: string | null; color: string | null; quantity: number }>(
    `
    SELECT
  p.name,
    pv.size,
    pv.color,
    SUM(si.quantity) as quantity
    FROM sale_items si
    JOIN sales s ON s.id = si.saleId
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    WHERE date(s.saleDate) = date(?)
    GROUP BY pv.id
    ORDER BY quantity DESC
    `,
    [dateStr],
  );

  return items.map(item => ({
    name: item.name,
    size: item.size ?? undefined,
    color: item.color ?? undefined,
    quantity: item.quantity,
  }));
}

const recordCustomerPurchase = async (customerId: number, amountIQD: number): Promise<void> => {
  await run(
    `
    UPDATE customers
    SET totalVisits = totalVisits + 1,
    totalSpentIQD = totalSpentIQD + ?,
    loyaltyPoints = loyaltyPoints + (? / 1000.0),
    lastVisitAt = ?
      WHERE id = ?
        `,
    [amountIQD, amountIQD, new Date().toISOString(), customerId],
  );
};

export async function attachSaleToCustomer(args: { saleId: number; customerId: number }): Promise<void> {
  await run(
    `
    UPDATE sales
    SET customerId = ?
    WHERE id = ?
      `,
    [args.customerId, args.saleId],
  );

  const sale = await get<{ totalIQD: number }>('SELECT totalIQD FROM sales WHERE id = ?', [args.saleId]);
  if (sale) {
    await recordCustomerPurchase(args.customerId, sale.totalIQD);
  }
}

interface CustomerSaleRow {
  id: number;
  saleDate: string;
  totalIQD: number;
  paymentMethod?: string | null;
}

interface CustomerSaleItemRow {
  saleId: number;
  variantId: number;
  quantity: number;
  lineTotalIQD: number;
  productName: string;
  color?: string | null;
  size?: string | null;
}

export async function deleteCustomer(customerId: number): Promise<boolean> {
  try {
    await run('DELETE FROM customers WHERE id = ?', [customerId]);
    return true;
  } catch (err) {
    log.error('Failed to delete customer:', err);
    throw err;
  }
}

export async function deleteSupplier(supplierId: number): Promise<boolean> {
  await run('BEGIN TRANSACTION');
  try {
    // 1. Check for Purchase Orders (Cannot delete if POs exist due to NOT NULL constraint and history)
    const poCount = await get<{ count: number }>('SELECT COUNT(*) as count FROM purchase_orders WHERE supplierId = ?', [supplierId]);
    if (poCount && poCount.count > 0) {
      throw new Error('Cannot delete supplier with existing purchase orders.');
    }

    // 2. Nullify references in Products (defaultSupplierId is nullable)
    await run('UPDATE products SET defaultSupplierId = NULL WHERE defaultSupplierId = ?', [supplierId]);

    // 3. Delete the supplier
    await run('DELETE FROM suppliers WHERE id = ?', [supplierId]);

    await run('COMMIT');
    return true;
  } catch (err) {
    await run('ROLLBACK');
    log.error('Failed to delete supplier:', err);
    throw err;
  }
}

export async function updateSupplier(id: number, data: SupplierInput): Promise<Supplier> {
  const { name, contactName, phone, email, address, notes, isActive } = data;
  try {
    await run(
      `UPDATE suppliers 
       SET name = ?, contactName = ?, phone = ?, email = ?, address = ?, notes = ?, isActive = ?
    WHERE id = ? `,
      [
        name,
        contactName ?? null,
        phone ?? null,
        email ?? null,
        address ?? null,
        notes ?? null,
        isActive ? 1 : 0,
        id
      ]
    );
    return {
      id,
      name,
      contactName: contactName ?? null,
      phone: phone ?? null,
      email: email ?? null,
      address: address ?? null,
      notes: notes ?? null,
      isActive: isActive ?? true,
    };
  } catch (err) {
    log.error('Failed to update supplier:', err);
    throw err;
  }
}

export async function getCustomerHistory(customerId: number): Promise<CustomerHistoryEntry[]> {
  const sales = await all<CustomerSaleRow>(
    `
    SELECT id, saleDate, totalIQD, paymentMethod
    FROM sales
    WHERE customerId = ?
    ORDER BY datetime(saleDate) DESC
    LIMIT 100
    `,
    [customerId],
  );

  if (!sales.length) {
    return [];
  }

  const saleIds = sales.map((sale) => sale.id);
  const placeholders = saleIds.map(() => '?').join(', ');
  const items = await all<CustomerSaleItemRow>(
    `
  SELECT
  si.saleId,
    si.variantId,
    si.quantity,
    si.lineTotalIQD,
    p.name AS productName,
      pv.color,
      pv.size
    FROM sale_items si
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    WHERE si.saleId IN(${placeholders})
    ORDER BY si.saleId DESC
    `,
    saleIds,
  );

  const itemsBySale = new Map<number, CustomerHistoryEntry['items']>();
  for (const item of items) {
    const list = itemsBySale.get(item.saleId) ?? [];
    list.push({
      variantId: item.variantId,
      productName: item.productName,
      color: item.color ?? null,
      size: item.size ?? null,
      quantity: item.quantity,
      lineTotalIQD: item.lineTotalIQD,
    });
    itemsBySale.set(item.saleId, list);
  }

  return sales.map((sale) => ({
    saleId: sale.id,
    saleDate: sale.saleDate,
    totalIQD: sale.totalIQD,
    paymentMethod: sale.paymentMethod ?? null,
    items: itemsBySale.get(sale.id) ?? [],
  }));
}

interface PurchaseOrderRow {
  id: number;
  supplierId: number;
  branchId: number;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  reference?: string | null;
  orderedAt?: string | null;
  receivedAt?: string | null;
  subtotalUSD: number;
  shippingUSD: number;
  taxesUSD: number;
  notes?: string | null;
  supplierName: string;
  branchName: string;
}

const fetchPurchaseOrderById = async (id: number): Promise<PurchaseOrderWithItems | null> => {
  const order = await get<PurchaseOrderRow>(
    `
  SELECT
  po.*,
    s.name AS supplierName,
      b.name AS branchName
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplierId
    JOIN branches b ON b.id = po.branchId
    WHERE po.id = ?
    `,
    [id],
  );

  if (!order) {
    return null;
  }

  const items = await all<PurchaseOrderItem>(
    `
    SELECT *
    FROM purchase_order_items
    WHERE purchaseOrderId = ?
    ORDER BY id ASC
      `,
    [id],
  );

  return {
    ...order,
    items,
  };
};

interface PurchaseOrderListRow extends PurchaseOrderRow {
  itemCount: number;
}

export async function listPurchaseOrders(): Promise<PurchaseOrderWithItems[]> {
  const orders = await all<PurchaseOrderListRow>(
    `
  SELECT
  po.*,
    s.name AS supplierName,
      b.name AS branchName,
        (
          SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.purchaseOrderId = po.id
      ) AS itemCount
    FROM purchase_orders po
    JOIN suppliers s ON s.id = po.supplierId
    JOIN branches b ON b.id = po.branchId
    ORDER BY COALESCE(po.receivedAt, po.orderedAt) DESC
    `,
  );

  if (!orders.length) {
    return [];
  }

  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map(() => '?').join(', ');
  
  const itemsRows = await all<PurchaseOrderItem>(
    `
    SELECT *
    FROM purchase_order_items
    WHERE purchaseOrderId IN (${placeholders})
    ORDER BY id ASC
    `,
    orderIds,
  );

  const itemsByOrder = new Map<number, PurchaseOrderItem[]>();
  for (const item of itemsRows) {
    const list = itemsByOrder.get(item.purchaseOrderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.purchaseOrderId, list);
  }

  const results: PurchaseOrderWithItems[] = orders.map((order) => {
    // Remove the extra itemCount property added by the listing query
    const { itemCount, ...orderWithoutCount } = order as any;
    return {
      ...orderWithoutCount,
      items: itemsByOrder.get(order.id) ?? [],
    };
  });

  return results;
}

export async function createPurchaseOrder(payload: PurchaseOrderInput): Promise<PurchaseOrderWithItems> {
  if (!payload.items?.length) {
    throw new Error('Purchase order must contain at least one item');
  }

  await run('BEGIN TRANSACTION');
  try {
    const insert = await runWithResult(
      `
      INSERT INTO purchase_orders(
      supplierId,
      branchId,
      status,
      reference,
      orderedAt,
      subtotalUSD,
      shippingUSD,
      taxesUSD,
      notes
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.supplierId,
        payload.branchId,
        payload.status ?? 'ordered',
        payload.reference ?? null,
        payload.orderedAt ?? new Date().toISOString(),
        payload.subtotalUSD ?? 0,
        payload.shippingUSD ?? 0,
        payload.taxesUSD ?? 0,
        payload.notes ?? null,
      ],
    );

    const purchaseOrderId = insert.lastID as number;

    for (const item of payload.items) {
      await run(
        `
        INSERT INTO purchase_order_items(
        purchaseOrderId,
        variantId,
        quantity,
        costUSD,
        costIQD
      ) VALUES(?, ?, ?, ?, ?)
        `,
        [
          purchaseOrderId,
          item.variantId,
          item.quantity,
          item.costUSD,
          item.costIQD,
        ],
      );
    }

    await run('COMMIT');

    const created = await fetchPurchaseOrderById(purchaseOrderId);
    if (!created) {
      throw new Error('Failed to load created purchase order');
    }

    return created;
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

export async function receivePurchaseOrder(input: PurchaseOrderReceiveInput): Promise<PurchaseOrderWithItems> {
  await run('BEGIN TRANSACTION');

  try {
    const order = await fetchPurchaseOrderById(input.purchaseOrderId);
    if (!order) {
      throw new Error('Purchase order not found');
    }

    if (order.status === 'received') {
      return order;
    }

    await run(
      `
      UPDATE purchase_orders
      SET status = 'received',
    receivedAt = ?
      WHERE id = ?
        `,
      [input.receivedAt ?? new Date().toISOString(), input.purchaseOrderId],
    );

    for (const item of order.items) {
      const variant = await get<{ avgCostUSD: number; id: number }>(
        `
        SELECT id, avgCostUSD, purchaseCostUSD
        FROM product_variants
        WHERE id = ?
    `,
        [item.variantId],
      );

      if (!variant) {
        throw new Error(`Variant ${item.variantId} not found`);
      }

      // Get current stock quantity for weighted average calculation
      const stock = await get<{ quantity: number }>(
        `
        SELECT quantity
        FROM variant_stock
        WHERE variantId = ? AND branchId = ?
    `,
        [item.variantId, order.branchId],
      );

      const currentStock = stock?.quantity ?? 0;
      const currentAvg = variant.avgCostUSD ?? item.costUSD;

      // Calculate weighted average: (currentStock * currentAvg + newQty * newCost) / (currentStock + newQty)
      // If no current stock, use the new cost as the average
      const newAvg = currentStock > 0
        ? (currentStock * currentAvg + item.quantity * item.costUSD) / (currentStock + item.quantity)
        : item.costUSD;

      await run(
        `
        UPDATE product_variants
        SET lastPurchaseCostUSD = ?,
    avgCostUSD = ?
      WHERE id = ?
        `,
        [item.costUSD, newAvg, item.variantId],
      );

      await adjustVariantStockInternal(
        item.variantId,
        order.branchId,
        item.quantity,
        'purchase_order',
        `PO #${order.id} `,
        input.receivedBy ?? null,
      );
    }

    await run('COMMIT');

    const updated = await fetchPurchaseOrderById(input.purchaseOrderId);
    if (!updated) {
      throw new Error('Failed to load updated purchase order');
    }

    return updated;
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

export async function createProduct(product: ProductInput): Promise<Product> {
  await run('BEGIN TRANSACTION');
  try {
    const productResult = await runWithResult(
      `
      INSERT INTO products(name, baseCode, category, season, description, defaultSupplierId)
  VALUES(?, ?, ?, ?, ?, ?)
    `,
      [
        product.name,
        product.code ?? null,
        product.category ?? null,
        product.season ?? null,
        product.description ?? null,
        product.supplierId ?? null,
      ],
    );

    const productId = productResult.lastID as number;
    const sku = generateSku(product.name, product.color, product.size);
    const barcode = product.barcode && product.barcode.trim().length > 0 ? product.barcode : generateBarcode();

    const variantResult = await runWithResult(
      `
      INSERT INTO product_variants(
      productId, size, color, sku, barcode,
      defaultPriceIQD, purchaseCostUSD, avgCostUSD, lastPurchaseCostUSD
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        productId,
        product.size ?? null,
        product.color ?? null,
        sku,
        barcode,
        product.salePriceIQD,
        product.purchaseCostUSD,
        product.purchaseCostUSD,
        product.purchaseCostUSD,
      ],
    );

    const variantId = variantResult.lastID as number;
    await ensureVariantStockRow(variantId, 1);

    await run('COMMIT');

    return mapVariantRow({
      variantId,
      productId,
      productName: product.name,
      category: product.category ?? null,
      baseCode: product.code ?? null,
      size: product.size ?? null,
      color: product.color ?? null,
      sku,
      barcode,
      defaultPriceIQD: product.salePriceIQD,
      purchaseCostUSD: product.purchaseCostUSD,
      avgCostUSD: product.purchaseCostUSD,
      lastPurchaseCostUSD: product.purchaseCostUSD,
      variantActive: 1,
      stockOnHand: 0,
    });
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

export async function createSale(input: SaleInput): Promise<SaleDetail> {
  if (!input.branchId || !input.cashierId) {
    throw new Error('branchId and cashierId are required for a sale');
  }

  await run('BEGIN TRANSACTION');

  try {
    const saleResult = await runWithResult(
      `
      INSERT INTO sales(
        branchId, cashierId, customerId, employeeId, saleDate,
        subtotalIQD, discountIQD, totalIQD, paymentMethod, profitIQD
      )
  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        input.branchId,
        input.cashierId,
        input.customerId ?? null,
        input.employeeId ?? null,
        input.saleDate,
        input.subtotalIQD,
        input.discountIQD ?? 0,
        input.totalIQD,
        input.paymentMethod ?? null,
        // Profit = Revenue (after discount) - Total Cost
        input.totalIQD - input.items.reduce(
          (acc, item) => acc + (item.unitCostIQDAtSale ?? 0) * item.quantity,
          0,
        ),
      ],
    );

    const saleId = saleResult.lastID as number;

    for (const item of input.items) {
      await run(
        `
        INSERT INTO sale_items(
      saleId, variantId, quantity,
      unitPriceIQD, unitCostIQDAtSale, lineTotalIQD
    )
  VALUES(?, ?, ?, ?, ?, ?)
      `,
        [
          saleId,
          item.variantId,
          item.quantity,
          item.unitPriceIQD,
          item.unitCostIQDAtSale ?? null,
          item.lineTotalIQD,
        ],
      );

      await adjustVariantStockInternal(
        item.variantId,
        input.branchId,
        -item.quantity,
        'sale',
        `Sale #${saleId} `,
        input.cashierId,
      );
    }

    if (input.customerId) {
      await recordCustomerPurchase(input.customerId, input.totalIQD);
    }

    await run('COMMIT');

    const fullDetail = await getSaleDetail(saleId);
    if (!fullDetail) {
      throw new Error('Failed to retrieve sale details after creation');
    }

    return fullDetail;
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

interface SaleRow {
  id: number;
  branchId: number;
  cashierId: number;
  customerId?: number | null;
  saleDate: string;
  subtotalIQD: number;
  discountIQD: number;
  totalIQD: number;
  paymentMethod?: string | null;
  profitIQD?: number | null;
}

export async function listSalesByDateRange(range: DateRange): Promise<SalesListResponse> {
  const salesRows = await all<any>(
    `
    SELECT
      s.*,
      e.name AS employeeName,
      (SELECT COUNT(*) FROM returns r WHERE r.saleId = s.id) > 0 as isReturned
    FROM sales s
    LEFT JOIN employees e ON e.id = s.employeeId
    WHERE date(s.saleDate, 'localtime') BETWEEN date(?) AND date(?)
    ORDER BY s.id DESC
    `,
    [range.startDate, range.endDate],
  );

  if (!salesRows.length) {
    return { sales: [] };
  }

  const saleIds = salesRows.map((s) => s.id);
  const placeholders = saleIds.map(() => '?').join(', ');
  const itemsRows = await all<SaleDetailItem>(
    `
  SELECT
  si.*,
    p.name AS productName,
      pv.color,
      pv.size
    FROM sale_items si
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    WHERE si.saleId IN(${placeholders})
    ORDER BY si.saleId ASC, si.id ASC
    `,
    saleIds,
  );

  const itemsBySale = new Map<number, SaleDetailItem[]>();
  for (const row of itemsRows) {
    const saleItems = itemsBySale.get(row.saleId) ?? [];
    saleItems.push(row);
    itemsBySale.set(row.saleId, saleItems);
  }

  const sales: SaleDetail[] = salesRows.map((row) => ({
    ...mapSaleRow(row),
    isReturned: Boolean(row.isReturned),
    items: itemsBySale.get(row.id) ?? [],
  }));

  return { sales };
}

interface ExchangeRateRow {
  id: number;
  rate: number;
  effectiveDate: string;
  note?: string | null;
  branchId?: number | null;
}

// Exchange rate cache
let exchangeRateCache: {
  rate: ExchangeRate | null;
  timestamp: number;
} | null = null;

const EXCHANGE_RATE_CACHE_TTL = 300000; // 5 minutes

export async function getCurrentExchangeRate(
  bypassCache = false
): Promise<ExchangeRateResponse> {
  const now = Date.now();

  // Check cache (unless bypass requested)
  if (!bypassCache && exchangeRateCache) {
    const age = now - exchangeRateCache.timestamp;
    if (age < EXCHANGE_RATE_CACHE_TTL) {
      return { currentRate: exchangeRateCache.rate };
    }
  }

  // Query database
  const row = await get<ExchangeRateRow>(
    `
  SELECT *
    FROM exchange_rates
    ORDER BY datetime(effectiveDate) DESC, id DESC
    LIMIT 1
    `,
  );

  const rate = row ? mapExchangeRateRow(row) : null;

  // Update cache
  exchangeRateCache = {
    rate,
    timestamp: now,
  };

  return { currentRate: rate };
}

export async function updateExchangeRate(
  input: ExchangeRateInput,
): Promise<ExchangeRateResponse> {
  const effectiveDate = input.effectiveDate ?? new Date().toISOString();
  await run(
    `
    INSERT INTO exchange_rates(rate, effectiveDate, note)
  VALUES(?, ?, ?)
    `,
    [input.rate, effectiveDate, input.note ?? null],
  );

  // IMPORTANT: Invalidate cache immediately
  exchangeRateCache = null;

  return getCurrentExchangeRate(true); // Bypass cache
}

export async function ensureAdminUser(): Promise<void> {
  // Get or create branch
  let branchId = (await get<{ id: number }>('SELECT id FROM branches WHERE name = ? LIMIT 1', ['EVA Main']))?.id;

  if (!branchId) {
    await run(
      `
      INSERT INTO branches(name, address, phone)
  VALUES(?, ?, ?)
    `,
      ['EVA Main', 'Baghdad, Iraq', '+964-000-0000'],
    );
    branchId = (await get<{ id: number }>('SELECT id FROM branches WHERE name = ? ORDER BY id DESC LIMIT 1', ['EVA Main']))?.id;
  }

  if (!branchId) {
    throw new Error('Failed to create or find branch');
  }

  // Check if admin exists
  const adminUser = await get<{ id: number }>('SELECT id FROM users WHERE username = ? LIMIT 1', ['admin']);

  if (!adminUser) {
    // Create admin user
    const passwordHash = await hashPassword('admin123');
    await run(
      `
      INSERT INTO users(username, passwordHash, role, branchId)
  VALUES(?, ?, ?, ?)
    `,
      ['admin', passwordHash, 'admin', branchId],
    );
    log.info('[db] Admin user created');
  }
}

export async function login(username: string, password: string): Promise<LoginResponse | null> {
  // Ensure admin user exists before login attempt
  if (username === 'admin') {
    try {
      await ensureAdminUser();
    } catch (err) {
      log.error('[db] Failed to ensure admin user:', err);
    }
  }

  const user = await get<{ id: number; passwordHash: string; role: string; branchId: number | null; requiresPasswordChange: number }>(`
    SELECT id, passwordHash, role, branchId, IFNULL(requiresPasswordChange, 0) as requiresPasswordChange
    FROM users
    WHERE username = ?
    `,
    [username],
  );

  if (!user) {
    return null;
  }

  // Verify password (supports old SHA-256 and new bcrypt)
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  // Auto-upgrade old SHA-256 hash to bcrypt
  if (user.passwordHash.length === 64 && /^[a-f0-9]+$/i.test(user.passwordHash)) {
    const newHash = await hashPassword(password);
    await run('UPDATE users SET passwordHash = ? WHERE id = ?', [newHash, user.id]);
    log.info(`[auth] Upgraded password hash for user: ${username}`);
  }

  const token = crypto.randomBytes(24).toString('hex');
  const session: UserSession = {
    token,
    userId: user.id,
    username,
    role: user.role as 'admin' | 'manager' | 'cashier',
    branchId: user.branchId ?? undefined,
    createdAt: new Date().toISOString(),
  };
  activeSessions.set(token, session);

  await logActivity(user.id, 'login', 'user', user.id);

  return {
    token,
    userId: user.id,
    username,
    role: session.role,
    branchId: session.branchId,
    requiresPasswordChange: user.requiresPasswordChange === 1,
  };
}

export async function logout(token: string): Promise<void> {
  const session = activeSessions.get(token);
  if (session) {
    await logActivity(session.userId, 'logout', 'user', session.userId);
    activeSessions.delete(token);
  }
}

// Password validation: minimum 8 chars, at least 1 number
const validatePasswordStrength = (password: string): { valid: boolean; error?: string } => {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true };
};

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  // Fetch current password hash
  const user = await get<{ passwordHash: string }>('SELECT passwordHash FROM users WHERE id = ?', [userId]);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Current password is incorrect' };
  }

  // Validate new password strength
  const validation = validatePasswordStrength(newPassword);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Ensure new password is different from current
  const isSame = await verifyPassword(newPassword, user.passwordHash);
  if (isSame) {
    return { success: false, error: 'New password must be different from current password' };
  }

  // Hash and update password
  const newHash = await hashPassword(newPassword);
  await run('UPDATE users SET passwordHash = ?, requiresPasswordChange = 0 WHERE id = ?', [newHash, userId]);

  await logActivity(userId, 'password_change', 'user', userId);

  return { success: true };
}

export function getSession(token?: string | null): UserSession | null {
  if (!token) return null;
  return activeSessions.get(token) ?? null;
}

export async function logActivity(
  userId: number,
  action: string,
  entity?: string | null,
  entityId?: number | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await run(
    `
    INSERT INTO activity_logs(userId, action, entity, entityId, metadata)
  VALUES(?, ?, ?, ?, ?)
    `,
    [userId, action, entity ?? null, entityId ?? null, metadata ? JSON.stringify(metadata) : null],
  );
}

export async function listActivityLogs(limit = 200): Promise<ActivityLogEntry[]> {
  return all<ActivityLogEntry>(
    `
    SELECT id, userId, action, entity, entityId, metadata, createdAt
    FROM activity_logs
    ORDER BY datetime(createdAt) DESC
  LIMIT ?
    `,
    [limit],
  );
}

export function getPosLockStatus(): { locked: boolean; lockedBy: number | null } {
  return { locked: posLocked, lockedBy: posLockedBy };
}

export function lockPos(userId: number): void {
  posLocked = true;
  posLockedBy = userId;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function unlockPos(_userId: number): void {
  posLocked = false;
  posLockedBy = null;
}

// ==================== USER MANAGEMENT ====================

export async function listUsers(): Promise<User[]> {
  const rows = await all<{
    id: number;
    username: string;
    role: string;
    branchId: number | null;
    isLocked: number;
    createdAt: string;
    branchName: string | null;
  }>(
    `
    SELECT
  u.id,
    u.username,
    u.role,
    u.branchId,
    u.isLocked,
    u.createdAt,
    b.name as branchName
    FROM users u
    LEFT JOIN branches b ON u.branchId = b.id
    ORDER BY u.createdAt DESC
    `,
  );

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role as 'admin' | 'manager' | 'cashier',
    branchId: row.branchId,
    branchName: row.branchName,
    isLocked: row.isLocked === 1,
    createdAt: row.createdAt,
  }));
}

export async function createUser(input: UserInput): Promise<User> {
  // Check if username already exists
  const existing = await get<{ id: number }>('SELECT id FROM users WHERE username = ?', [input.username]);
  if (existing) {
    throw new Error('Username already exists');
  }

  // Validate branch exists if provided
  if (input.branchId) {
    const branch = await get<{ id: number }>('SELECT id FROM branches WHERE id = ?', [input.branchId]);
    if (!branch) {
      throw new Error('Branch not found');
    }
  }

  const passwordHash = await hashPassword(input.password);
  const result = await runWithResult(
    `
    INSERT INTO users(username, passwordHash, role, branchId)
  VALUES(?, ?, ?, ?)
    `,
    [input.username, passwordHash, input.role, input.branchId ?? null],
  );

  const user = await get<{
    id: number;
    username: string;
    role: string;
    branchId: number | null;
    isLocked: number;
    createdAt: string;
    branchName: string | null;
  }>(
    `
  SELECT
  u.id,
    u.username,
    u.role,
    u.branchId,
    u.isLocked,
    u.createdAt,
    b.name as branchName
    FROM users u
    LEFT JOIN branches b ON u.branchId = b.id
    WHERE u.id = ?
    `,
    [result.lastID],
  );

  if (!user) {
    throw new Error('Failed to create user');
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role as 'admin' | 'manager' | 'cashier',
    branchId: user.branchId,
    branchName: user.branchName,
    isLocked: user.isLocked === 1,
    createdAt: user.createdAt,
  };
}

export async function updateUser(input: UserUpdateInput): Promise<User> {
  // Check if user exists
  const existing = await get<{ id: number }>('SELECT id FROM users WHERE id = ?', [input.id]);
  if (!existing) {
    throw new Error('User not found');
  }

  // Check username uniqueness if changing username
  if (input.username) {
    const duplicate = await get<{ id: number }>(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [input.username, input.id],
    );
    if (duplicate) {
      throw new Error('Username already exists');
    }
  }

  // Validate branch if provided
  if (input.branchId !== undefined && input.branchId !== null) {
    const branch = await get<{ id: number }>('SELECT id FROM branches WHERE id = ?', [input.branchId]);
    if (!branch) {
      throw new Error('Branch not found');
    }
  }

  // Build update query dynamically
  const updates: string[] = [];
  const params: SqlValue[] = [];

  if (input.username) {
    updates.push('username = ?');
    params.push(input.username);
  }

  if (input.password) {
    updates.push('passwordHash = ?');
    const passwordHash = await hashPassword(input.password);
    params.push(passwordHash);
  }

  if (input.role) {
    updates.push('role = ?');
    params.push(input.role);
  }

  if (input.branchId !== undefined) {
    updates.push('branchId = ?');
    params.push(input.branchId ?? null);
  }

  if (input.isLocked !== undefined) {
    updates.push('isLocked = ?');
    params.push(input.isLocked ? 1 : 0);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  params.push(input.id);
  await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ? `, params);

  const user = await get<{
    id: number;
    username: string;
    role: string;
    branchId: number | null;
    isLocked: number;
    createdAt: string;
    branchName: string | null;
  }>(
    `
    SELECT
  u.id,
    u.username,
    u.role,
    u.branchId,
    u.isLocked,
    u.createdAt,
    b.name as branchName
    FROM users u
    LEFT JOIN branches b ON u.branchId = b.id
    WHERE u.id = ?
    `,
    [input.id],
  );

  if (!user) {
    throw new Error('Failed to update user');
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role as 'admin' | 'manager' | 'cashier',
    branchId: user.branchId,
    branchName: user.branchName,
    isLocked: user.isLocked === 1,
    createdAt: user.createdAt,
  };
}

export async function deleteUser(userId: number): Promise<void> {
  // Prevent deleting yourself
  // This check should be done at IPC level with session

  // Check if user exists
  const user = await get<{ id: number; username: string }>('SELECT id, username FROM users WHERE id = ?', [userId]);
  if (!user) {
    throw new Error('User not found');
  }

  // Prevent deleting admin user
  if (user.username === 'admin') {
    throw new Error('Cannot delete admin user');
  }

  await run('DELETE FROM users WHERE id = ?', [userId]);
}

// ==================== BRANCH MANAGEMENT ====================

export async function listBranches(): Promise<Branch[]> {
  const rows = await all<{
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    currency: string;
    isActive: number;
  }>('SELECT id, name, address, phone, currency, isActive FROM branches ORDER BY name');

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    currency: row.currency,
    isActive: row.isActive === 1,
  }));
}

export async function createBranch(input: BranchInput): Promise<Branch> {
  // Check if branch name already exists
  const existing = await get<{ id: number }>('SELECT id FROM branches WHERE name = ?', [input.name]);
  if (existing) {
    throw new Error('Branch name already exists');
  }

  const result = await runWithResult(
    `
    INSERT INTO branches(name, address, phone, currency)
  VALUES(?, ?, ?, ?)
    `,
    [input.name, input.address ?? null, input.phone ?? null, input.currency ?? 'IQD'],
  );

  const branch = await get<{
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    currency: string;
    isActive: number;
  }>('SELECT id, name, address, phone, currency, isActive FROM branches WHERE id = ?', [result.lastID]);

  if (!branch) {
    throw new Error('Failed to create branch');
  }

  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    currency: branch.currency,
    isActive: branch.isActive === 1,
  };
}

export async function updateBranch(input: BranchUpdateInput): Promise<Branch> {
  const existing = await get<{ id: number }>('SELECT id FROM branches WHERE id = ?', [input.id]);
  if (!existing) {
    throw new Error('Branch not found');
  }

  // Check name uniqueness if changing name
  if (input.name) {
    const duplicate = await get<{ id: number }>(
      'SELECT id FROM branches WHERE name = ? AND id != ?',
      [input.name, input.id],
    );
    if (duplicate) {
      throw new Error('Branch name already exists');
    }
  }

  const updates: string[] = [];
  const params: SqlValue[] = [];

  if (input.name) {
    updates.push('name = ?');
    params.push(input.name);
  }

  if (input.address !== undefined) {
    updates.push('address = ?');
    params.push(input.address ?? null);
  }

  if (input.phone !== undefined) {
    updates.push('phone = ?');
    params.push(input.phone ?? null);
  }

  if (input.currency) {
    updates.push('currency = ?');
    params.push(input.currency);
  }

  if (input.isActive !== undefined) {
    updates.push('isActive = ?');
    params.push(input.isActive ? 1 : 0);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  params.push(input.id);
  await run(`UPDATE branches SET ${updates.join(', ')} WHERE id = ? `, params);

  const branch = await get<{
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    currency: string;
    isActive: number;
  }>('SELECT id, name, address, phone, currency, isActive FROM branches WHERE id = ?', [input.id]);

  if (!branch) {
    throw new Error('Failed to update branch');
  }

  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    currency: branch.currency,
    isActive: branch.isActive === 1,
  };
}

// ==================== PRODUCT UPDATE ====================

export async function updateProduct(input: ProductUpdateInput): Promise<Product> {
  const existing = await get<{ id: number }>('SELECT id FROM products WHERE id = ?', [input.id]);
  if (!existing) {
    throw new Error('Product not found');
  }

  const updates: string[] = [];
  const params: SqlValue[] = [];

  if (input.name) {
    updates.push('name = ?');
    params.push(input.name);
  }

  if (input.baseCode !== undefined) {
    updates.push('baseCode = ?');
    params.push(input.baseCode ?? null);
  }

  if (input.category !== undefined) {
    updates.push('category = ?');
    params.push(input.category ?? null);
  }

  if (input.season !== undefined) {
    updates.push('season = ?');
    params.push(input.season ?? null);
  }

  if (input.description !== undefined) {
    updates.push('description = ?');
    params.push(input.description ?? null);
  }

  if (input.defaultSupplierId !== undefined) {
    updates.push('defaultSupplierId = ?');
    params.push(input.defaultSupplierId ?? null);
  }

  if (input.isActive !== undefined) {
    updates.push('isActive = ?');
    params.push(input.isActive ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push('updatedAt = CURRENT_TIMESTAMP');
    params.push(input.id);
    await run(`UPDATE products SET ${updates.join(', ')} WHERE id = ? `, params);
  }

  // Return updated product
  const productsResponse = await listProductsLegacy();
  const updated = productsResponse.products.find((p: Product) => p.id === input.id);
  if (!updated) {
    throw new Error('Failed to update product');
  }

  return updated;
}

export async function updateVariant(input: VariantUpdateInput): Promise<void> {
  const existing = await get<{ id: number }>('SELECT id FROM product_variants WHERE id = ?', [input.id]);
  if (!existing) {
    throw new Error('Variant not found');
  }

  const updates: string[] = [];
  const params: SqlValue[] = [];

  if (input.size !== undefined) {
    updates.push('size = ?');
    params.push(input.size ?? null);
  }

  if (input.color !== undefined) {
    updates.push('color = ?');
    params.push(input.color ?? null);
  }

  if (input.defaultPriceIQD !== undefined) {
    updates.push('defaultPriceIQD = ?');
    params.push(input.defaultPriceIQD);
  }

  if (input.purchaseCostUSD !== undefined) {
    updates.push('purchaseCostUSD = ?');
    params.push(input.purchaseCostUSD);
  }

  if (input.isActive !== undefined) {
    updates.push('isActive = ?');
    params.push(input.isActive ? 1 : 0);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  params.push(input.id);
  await run(`UPDATE product_variants SET ${updates.join(', ')} WHERE id = ? `, params);
}

export async function deleteVariant(variantId: number): Promise<void> {
  const existing = await get<{ id: number }>('SELECT id FROM product_variants WHERE id = ?', [variantId]);
  if (!existing) {
    throw new Error('Variant not found');
  }

  // Check if variant has been used in any sales
  const saleItem = await get<{ id: number }>(
    'SELECT id FROM sale_items WHERE variantId = ? LIMIT 1',
    [variantId],
  );
  if (saleItem) {
    throw new Error('Cannot delete variant that has been used in sales. Deactivate it instead.');
  }

  // Delete variant (cascade will handle stock and adjustments)
  await run('DELETE FROM product_variants WHERE id = ?', [variantId]);
}

export async function bulkUpdateProducts(_token: string, payload: { productIds: number[]; season?: string | null }): Promise<void> {
  const { productIds, season } = payload;
  if (!productIds.length) return;

  const placeholders = productIds.map(() => '?').join(',');
  const sql = `UPDATE products SET season = ? WHERE id IN (${placeholders})`;
  await run(sql, [season ?? null, ...productIds]);
}

// ==================== RETURN MANAGEMENT ====================

export async function createReturn(input: ReturnInput): Promise<ReturnResponse> {
  await run('BEGIN TRANSACTION');
  try {
    const refundAmount =
      input.refundAmountIQD ??
      input.items
        .filter((item) => item.direction !== 'exchange_in')
        .reduce((acc, item) => acc + (item.amountIQD ?? 0), 0);

    const insert = await runWithResult(
      `
      INSERT INTO returns(
    saleId,
    branchId,
    customerId,
    refundAmountIQD,
    reason,
    processedBy,
    type,
    createdAt
  ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        input.saleId ?? null,
        input.branchId,
        input.customerId ?? null,
        refundAmount,
        input.reason ?? null,
        input.processedBy ?? null,
        input.type,
        new Date().toISOString(), // Use ISO string for consistency with sales
      ],
    );

    const returnId = insert.lastID as number;

    let totalReturnCost = 0;

    for (const item of input.items) {
      const direction = item.direction ?? 'return';

      // Calculate cost for this item
      let itemCost = 0;
      if (item.saleItemId) {
        // Try to get original cost from sale
        const saleItem = await get<{ unitCostIQDAtSale?: number }>('SELECT unitCostIQDAtSale FROM sale_items WHERE id = ?', [item.saleItemId]);
        if (saleItem && saleItem.unitCostIQDAtSale) {
          itemCost = saleItem.unitCostIQDAtSale * item.quantity;
        }
      }

      if (itemCost === 0) {
        // Fallback to current average cost
        const variant = await get<{ avgCostUSD: number }>('SELECT avgCostUSD FROM product_variants WHERE id = ?', [item.variantId]);
        const exchangeRate = await get<{ rate: number }>('SELECT rate FROM exchange_rates ORDER BY id DESC LIMIT 1');
        const rate = exchangeRate?.rate ?? 1500; // Default fallback
        itemCost = (variant?.avgCostUSD ?? 0) * rate * item.quantity;
      }

      if (direction !== 'exchange_in') {
        totalReturnCost += itemCost;
      }

      await run(
        `
        INSERT INTO return_items(
      returnId,
      saleItemId,
      variantId,
      quantity,
      amountIQD
    ) VALUES(?, ?, ?, ?, ?)
      `,
        [returnId, item.saleItemId ?? null, item.variantId, item.quantity, item.amountIQD ?? 0],
      );

      // Stock adjustment logic:
      // - 'return' or 'exchange_out': customer returns item, ADD to stock (positive delta)
      // - 'exchange_in': customer takes new item, REMOVE from stock (negative delta)
      const delta = direction === 'exchange_in' ? -Math.abs(item.quantity) : Math.abs(item.quantity);
      const reason = direction === 'exchange_in' ? 'exchange_in' : direction === 'exchange_out' ? 'exchange_out' : 'return';
      await adjustVariantStockInternal(
        item.variantId,
        input.branchId,
        delta,
        reason,
        input.reason ?? 'Return',
        input.processedBy,
      );
    }

    // Update the return with the calculated cost
    await run('UPDATE returns SET totalCostIQD = ? WHERE id = ?', [totalReturnCost, returnId]);

    await run('COMMIT');

    const created = await fetchReturnById(returnId);
    if (!created) {
      throw new Error('Failed to load created return');
    }

    return created;
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

export async function getSaleForReturn(saleId: number) {
  return getSaleDetail(saleId);
}

export async function fetchReturnById(id: number): Promise<ReturnResponse | null> {
  const row = await get<ReturnRecord>(
    `
  SELECT *
    FROM returns
    WHERE id = ?
    `,
    [id],
  );

  if (!row) return null;

  const items = await all<ReturnItem>(
    `
    SELECT *
    FROM return_items
    WHERE returnId = ?
    `,
    [id],
  );

  return {
    ...row,
    items,
  };
}

export async function listReturns(branchId?: number): Promise<ReturnResponse[]> {
  const query = branchId
    ? 'SELECT * FROM returns WHERE branchId = ? ORDER BY createdAt DESC'
    : 'SELECT * FROM returns ORDER BY createdAt DESC';
  const params = branchId ? [branchId] : [];

  const rows = await all<ReturnRecord>(query, params);

  const returns: ReturnResponse[] = [];
  for (const row of rows) {
    const items = await all<ReturnItem>(
      `
      SELECT *
    FROM return_items
      WHERE returnId = ?
    `,
      [row.id],
    );
    returns.push({ ...row, items });
  }

  return returns;
}

// --- Expenses ---

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const result = await runWithResult(
    `
    INSERT INTO expenses(branchId, category, amountIQD, expenseDate, note, enteredBy)
  VALUES(?, ?, ?, ?, ?, ?)
    `,
    [input.branchId, input.category, input.amountIQD, input.expenseDate, input.note ?? null, input.enteredBy ?? null],
  );

  return {
    id: result.lastID as number,
    ...input,
  };
}

export async function listExpenses(branchId?: number): Promise<Expense[]> {
  const query = branchId
    ? 'SELECT * FROM expenses WHERE branchId = ? ORDER BY expenseDate DESC'
    : 'SELECT * FROM expenses ORDER BY expenseDate DESC';
  const params = branchId ? [branchId] : [];
  return all<Expense>(query, params);
}

export async function deleteExpense(expenseId: number): Promise<boolean> {
  await run('DELETE FROM expenses WHERE id = ?', [expenseId]);
  return true;
}

export async function getExpenseSummary(range: DateRange): Promise<ExpenseSummary> {
  const totalRow = await get<{ total: number }>(
    `
    SELECT IFNULL(SUM(amountIQD), 0) as total
    FROM expenses
    WHERE date(expenseDate) >= date(?) AND date(expenseDate) <= date(?)
    `,
    [range.startDate, range.endDate],
  );

  const categoryRows = await all<{ category: string; total: number }>(
    `
    SELECT category, IFNULL(SUM(amountIQD), 0) as total
    FROM expenses
    WHERE date(expenseDate) >= date(?) AND date(expenseDate) <= date(?)
    GROUP BY category
    `,
    [range.startDate, range.endDate],
  );

  return {
    totalIQD: totalRow?.total ?? 0,
    categories: categoryRows.map((r) => ({ category: r.category, amountIQD: r.total })),
  };
}

// ==================== DASHBOARD KPIs ====================

export async function getDashboardKPIs(branchId?: number, dateRange?: { startDate: string; endDate: string }): Promise<DashboardKPIs> {
  const today = new Date().toISOString().split('T')[0];
  const startDate = dateRange?.startDate || today;
  const endDate = dateRange?.endDate || today;

  // Sales for date range
  const todaySalesQuery = branchId
    ? `
  SELECT
  COUNT(*) as count,
    IFNULL(SUM(totalIQD), 0) as totalIQD,
    IFNULL(SUM(profitIQD), 0) as profitIQD
      FROM sales
      WHERE date(saleDate) >= date(?) AND date(saleDate) <= date(?) AND branchId = ?
    `
    : `
      SELECT
  COUNT(*) as count,
    IFNULL(SUM(totalIQD), 0) as totalIQD,
    IFNULL(SUM(profitIQD), 0) as profitIQD
      FROM sales
      WHERE date(saleDate) >= date(?) AND date(saleDate) <= date(?)
    `;

  const todaySalesParams = branchId ? [startDate, endDate, branchId] : [startDate, endDate];
  const todaySalesRow = await get<{ count: number; totalIQD: number; profitIQD: number }>(
    todaySalesQuery,
    todaySalesParams,
  );

  // Returns for date range (to subtract from sales for NET revenue)
  const todayReturnsQuery = branchId
    ? `
  SELECT
  IFNULL(SUM(refundAmountIQD), 0) as totalReturnsIQD,
    IFNULL(SUM(totalCostIQD), 0) as totalReturnsCostIQD
      FROM returns
      WHERE date(createdAt) >= date(?) AND date(createdAt) <= date(?) AND branchId = ?
    `
    : `
      SELECT
  IFNULL(SUM(refundAmountIQD), 0) as totalReturnsIQD,
    IFNULL(SUM(totalCostIQD), 0) as totalReturnsCostIQD
      FROM returns
      WHERE date(createdAt) >= date(?) AND date(createdAt) <= date(?)
    `;

  const todayReturnsParams = branchId ? [startDate, endDate, branchId] : [startDate, endDate];
  const todayReturnsRow = await get<{ totalReturnsIQD: number; totalReturnsCostIQD: number }>(
    todayReturnsQuery,
    todayReturnsParams,
  );

  const totalReturnsIQD = todayReturnsRow?.totalReturnsIQD ?? 0;
  const totalReturnsCostIQD = todayReturnsRow?.totalReturnsCostIQD ?? 0;

  // Calculate NET sales (sales minus returns)
  const grossSalesIQD = todaySalesRow?.totalIQD ?? 0;
  const grossProfitIQD = todaySalesRow?.profitIQD ?? 0;
  const netSalesIQD = grossSalesIQD - totalReturnsIQD;
  const netProfitIQD = grossProfitIQD - (totalReturnsIQD - totalReturnsCostIQD); // Returns reduce profit by (Refund - Cost)

  // Total items sold (sum of quantities from sale_items)
  const totalItemsQuery = branchId
    ? `
      SELECT IFNULL(SUM(si.quantity), 0) as totalItems
      FROM sale_items si
      JOIN sales s ON s.id = si.saleId
      WHERE date(s.saleDate) >= date(?) AND date(s.saleDate) <= date(?) AND s.branchId = ?
    `
    : `
      SELECT IFNULL(SUM(si.quantity), 0) as totalItems
      FROM sale_items si
      JOIN sales s ON s.id = si.saleId
      WHERE date(s.saleDate) >= date(?) AND date(s.saleDate) <= date(?)
    `;
  const totalItemsParams = branchId ? [startDate, endDate, branchId] : [startDate, endDate];
  const totalItemsRow = await get<{ totalItems: number }>(totalItemsQuery, totalItemsParams);

  const todaySales = {
    count: todaySalesRow?.count ?? 0,
    totalItemsSold: totalItemsRow?.totalItems ?? 0,
    totalIQD: netSalesIQD, // NET sales (after returns)
    profitIQD: netProfitIQD, // NET profit (after returns)
    avgTicket: todaySalesRow?.count && todaySalesRow.count > 0
      ? (netSalesIQD / todaySalesRow.count) // Average based on NET sales
      : 0,
  };

  // Expenses for date range
  const todayExpensesQuery = branchId
    ? `
      SELECT IFNULL(SUM(amountIQD), 0) as total
      FROM expenses
      WHERE date(expenseDate) >= date(?) AND date(expenseDate) <= date(?) AND branchId = ?
    `
    : `
      SELECT IFNULL(SUM(amountIQD), 0) as total
      FROM expenses
      WHERE date(expenseDate) >= date(?) AND date(expenseDate) <= date(?)
    `;

  const todayExpensesRow = await get<{ total: number }>(
    todayExpensesQuery,
    branchId ? [startDate, endDate, branchId] : [startDate, endDate],
  );

  // Low stock count
  const lowStockQuery = branchId
    ? `
      SELECT COUNT(*) as count
      FROM variant_stock vs
      WHERE vs.quantity <= vs.lowStockThreshold AND vs.branchId = ?
    `
    : `
      SELECT COUNT(*) as count
      FROM variant_stock vs
      WHERE vs.quantity <= vs.lowStockThreshold
    `;

  const lowStockRow = await get<{ count: number }>(
    lowStockQuery,
    branchId ? [branchId] : [],
  );

  // Recent sales (last 10) for date range
  const recentSalesQuery = branchId
    ? `
  SELECT *
    FROM sales
      WHERE date(saleDate) >= date(?) AND date(saleDate) <= date(?) AND branchId = ?
    ORDER BY saleDate DESC, id DESC
      LIMIT 10
    `
    : `
  SELECT *
    FROM sales
      WHERE date(saleDate) >= date(?) AND date(saleDate) <= date(?)
      ORDER BY saleDate DESC, id DESC
      LIMIT 10
    `;

  const recentSalesRows = await all<SaleRow>(
    recentSalesQuery,
    branchId ? [startDate, endDate, branchId] : [startDate, endDate],
  );

  const recentSales: Sale[] = recentSalesRows.map(mapSaleRow);

  // Low stock items
  const lowStockItemsQuery = branchId
    ? `
  SELECT
  pv.sku,
    p.name AS productName,
      pv.color,
      pv.size,
      vs.quantity
      FROM variant_stock vs
      JOIN product_variants pv ON pv.id = vs.variantId
      JOIN products p ON p.id = pv.productId
      WHERE vs.quantity <= vs.lowStockThreshold AND vs.branchId = ?
    ORDER BY vs.quantity ASC
      LIMIT 10
    `
    : `
  SELECT
  pv.sku,
    p.name AS productName,
      pv.color,
      pv.size,
      vs.quantity
      FROM variant_stock vs
      JOIN product_variants pv ON pv.id = vs.variantId
      JOIN products p ON p.id = pv.productId
      WHERE vs.quantity <= vs.lowStockThreshold
      ORDER BY vs.quantity ASC
      LIMIT 10
    `;

  const lowStockItems = await all<{
    sku: string;
    productName: string;
    color: string | null;
    size: string | null;
    quantity: number;
  }>(lowStockItemsQuery, branchId ? [branchId] : []);

  // Top selling items for date range
  const topSellingQuery = branchId
    ? `
      SELECT
        p.name AS productName,
        pv.color,
        pv.size,
        pv.sku,
        SUM(si.quantity) AS totalQty,
        SUM(si.lineTotalIQD) AS revenueIQD
      FROM sale_items si
      JOIN sales s ON s.id = si.saleId
      JOIN product_variants pv ON pv.id = si.variantId
      JOIN products p ON p.id = pv.productId
      WHERE date(s.saleDate) >= date(?) AND date(s.saleDate) <= date(?) AND s.branchId = ?
      GROUP BY si.variantId
      ORDER BY totalQty DESC
      LIMIT 10
    `
    : `
      SELECT
        p.name AS productName,
        pv.color,
        pv.size,
        pv.sku,
        SUM(si.quantity) AS totalQty,
        SUM(si.lineTotalIQD) AS revenueIQD
      FROM sale_items si
      JOIN sales s ON s.id = si.saleId
      JOIN product_variants pv ON pv.id = si.variantId
      JOIN products p ON p.id = pv.productId
      WHERE date(s.saleDate) >= date(?) AND date(s.saleDate) <= date(?)
      GROUP BY si.variantId
      ORDER BY totalQty DESC
      LIMIT 10
    `;

  const topSellingItems = await all<{
    productName: string;
    color: string | null;
    size: string | null;
    sku: string;
    totalQty: number;
    revenueIQD: number;
  }>(topSellingQuery, branchId ? [startDate, endDate, branchId] : [startDate, endDate]);

  return {
    todaySales,
    todayExpenses: todayExpensesRow?.total ?? 0,
    lowStockCount: lowStockRow?.count ?? 0,
    recentSales,
    lowStockItems,
    topSellingItems,
  };
}


export async function deleteSale(saleId: number, userId: number): Promise<void> {
  await run('BEGIN TRANSACTION');
  try {
    // 1. Get sale details
    const sale = await getSaleDetail(saleId);
    if (!sale) {
      throw new Error('Sale not found');
    }

    // 2. Handle associated returns (Fix for FOREIGN KEY constraint)
    const returns = await all<{ id: number; branchId: number }>(
      'SELECT id, branchId FROM returns WHERE saleId = ?',
      [saleId]
    );

    for (const ret of returns) {
      // Get return items to reverse stock adjustments
      const returnItems = await all<{
        saleItemId: number | null;
        variantId: number;
        quantity: number;
      }>('SELECT saleItemId, variantId, quantity FROM return_items WHERE returnId = ?', [ret.id]);

      for (const item of returnItems) {
        if (item.saleItemId) {
          // Was a RETURN (Stock added) -> Reverse by SUBTRACTING
          await adjustVariantStockInternal(
            item.variantId,
            ret.branchId,
            -item.quantity,
            'Sale Deleted',
            `Reversed return for deleted sale #${saleId}`
          );
        } else {
          // Was an EXCHANGE_IN (Stock removed) -> Reverse by ADDING
          await adjustVariantStockInternal(
            item.variantId,
            ret.branchId,
            item.quantity,
            'Sale Deleted',
            `Reversed exchange for deleted sale #${saleId}`
          );
        }
      }

      // Delete return records
      await run('DELETE FROM return_items WHERE returnId = ?', [ret.id]);
      await run('DELETE FROM returns WHERE id = ?', [ret.id]);
    }

    // 3. Restore stock for sale items (Sale removed stock -> Add it back)
    for (const item of sale.items) {
      await adjustVariantStockInternal(
        item.variantId,
        sale.branchId,
        item.quantity,
        'Sale Deleted',
        `Restored stock from deleted sale #${saleId}`
      );
    }

    // 4. Revert customer stats if attached
    if (sale.customerId) {
      await run(
        `
        UPDATE customers
        SET totalVisits = MAX(0, totalVisits - 1),
    totalSpentIQD = MAX(0, totalSpentIQD - ?),
    loyaltyPoints = MAX(0, loyaltyPoints - (? / 1000.0))
        WHERE id = ?
    `,
        [sale.totalIQD, sale.totalIQD, sale.customerId]
      );
    }

    // 5. Delete items and sale
    await run('DELETE FROM sale_items WHERE saleId = ?', [saleId]);
    await run('DELETE FROM sales WHERE id = ?', [saleId]);

    // 6. Log activity with metadata
    const restockedSummary = sale.items.map(item => `${item.productName} (${item.quantity})`).join(', ');
    await logActivity(userId, 'delete', 'sale', saleId, { 
      details: `Restored stock: ${restockedSummary}`,
      items: sale.items.map(i => ({ name: i.productName, qty: i.quantity }))
    });

    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }
}

export async function resetDatabase(): Promise<void> {
  await run('BEGIN TRANSACTION');
  try {
    // Delete all business data in correct order (child tables first)

    // 1. Transactional items (referencing products, sales, etc.)
    await run('DELETE FROM return_items');
    await run('DELETE FROM returns'); // References sales, customers
    await run('DELETE FROM sale_items');
    await run('DELETE FROM sales'); // References customers, users

    await run('DELETE FROM purchase_order_items');
    await run('DELETE FROM purchase_orders'); // References suppliers

    await run('DELETE FROM inventory_adjustments'); // References variants
    await run('DELETE FROM variant_stock'); // References variants

    // 2. Catalog items
    await run('DELETE FROM product_variants'); // References products
    await run('DELETE FROM products'); // References suppliers

    // 3. Entities
    await run('DELETE FROM expenses');
    await run('DELETE FROM suppliers');
    await run('DELETE FROM customers');
    await run('DELETE FROM activity_logs');

    // Reset sequences
    await run("DELETE FROM sqlite_sequence WHERE name IN ('sale_items', 'sales', 'return_items', 'returns', 'purchase_order_items', 'purchase_orders', 'expenses', 'inventory_adjustments', 'variant_stock', 'product_variants', 'products', 'suppliers', 'customers', 'activity_logs')");

    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }
}

// â”€â”€â”€ Online Orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function mapOnlineOrderRow(row: any, itemRows: any[]): OnlineOrder {
  return {
    id: row.id,
    branchId: row.branchId,
    cashierId: row.cashierId,
    customerId: row.customerId ?? null,
    customerName: row.customerName ?? row.customerNameFromDb ?? null,
    customerPhone: row.customerPhone ?? null,
    source: row.source,
    note: row.note ?? null,
    status: row.status,
    subtotalIQD: row.subtotalIQD,
    discountIQD: row.discountIQD,
    totalIQD: row.totalIQD,
    createdAt: row.createdAt,
    confirmedAt: row.confirmedAt ?? null,
    rejectedAt: row.rejectedAt ?? null,
    rejectionReason: row.rejectionReason ?? null,
    saleId: row.saleId ?? null,
    items: itemRows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      variantId: r.variantId,
      productName: r.productName,
      color: r.color ?? null,
      size: r.size ?? null,
      sku: r.sku,
      quantity: r.quantity,
      unitPriceIQD: r.unitPriceIQD,
      lineTotalIQD: r.lineTotalIQD,
    })),
  };
}

async function fetchOnlineOrderItems(orderId: number): Promise<any[]> {
  return all<any>(
    `SELECT oi.*,
            p.name AS productName,
            pv.color,
            pv.size,
            pv.sku
     FROM online_order_items oi
     JOIN product_variants pv ON pv.id = oi.variantId
     JOIN products p ON p.id = pv.productId
     WHERE oi.orderId = ?`,
    [orderId],
  );
}

export async function getOnlineOrderById(orderId: number): Promise<OnlineOrder | null> {
  const row = await get<any>(
    `SELECT o.*, c.name AS customerNameFromDb
     FROM online_orders o
     LEFT JOIN customers c ON c.id = o.customerId
     WHERE o.id = ?`,
    [orderId],
  );
  if (!row) return null;
  const itemRows = await fetchOnlineOrderItems(orderId);
  return mapOnlineOrderRow(row, itemRows);
}

export async function listOnlineOrders(status?: string): Promise<OnlineOrder[]> {
  const rows = await all<any>(
    `SELECT o.*, c.name AS customerNameFromDb
     FROM online_orders o
     LEFT JOIN customers c ON c.id = o.customerId
     ${status ? 'WHERE o.status = ?' : ''}
     ORDER BY o.createdAt DESC`,
    status ? [status] : [],
  );

  if (rows.length === 0) return [];

  // Bulk-fetch all items for these orders in one query
  const orderIds = rows.map(r => r.id);
  const placeholders = orderIds.map(() => '?').join(',');
  const allItemRows = await all<any>(
    `SELECT oi.*,
            p.name AS productName,
            pv.color,
            pv.size,
            pv.sku
     FROM online_order_items oi
     JOIN product_variants pv ON pv.id = oi.variantId
     JOIN products p ON p.id = pv.productId
     WHERE oi.orderId IN (${placeholders})`,
    orderIds,
  );

  // Group items by orderId
  const itemsByOrder = new Map<number, any[]>();
  for (const item of allItemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  return rows.map(row => mapOnlineOrderRow(row, itemsByOrder.get(row.id) ?? []));
}

export async function createOnlineOrder(
  input: OnlineOrderInput,
  cashierId: number,
): Promise<OnlineOrder> {
  const result = await runWithResult(
    `INSERT INTO online_orders
      (branchId, cashierId, customerId, customerName, customerPhone, source, note,
       status, subtotalIQD, discountIQD, totalIQD, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      input.branchId,
      cashierId,
      input.customerId ?? null,
      input.customerName ?? null,
      input.customerPhone ?? null,
      input.source,
      input.note ?? null,
      input.subtotalIQD,
      input.discountIQD,
      input.totalIQD,
    ],
  );
  const orderId = result.lastID;

  for (const item of input.items) {
    await run(
      `INSERT INTO online_order_items (orderId, variantId, quantity, unitPriceIQD, lineTotalIQD)
       VALUES (?, ?, ?, ?, ?)`,
      [orderId, item.variantId, item.quantity, item.unitPriceIQD, item.lineTotalIQD],
    );
  }

  return (await getOnlineOrderById(orderId))!;
}

export async function confirmOnlineOrder(
  orderId: number,
  userId: number,
  exchangeRate: number,
): Promise<OnlineOrder> {
  const order = await getOnlineOrderById(orderId);
  if (!order) throw new Error('Online order not found');
  if (order.status !== 'pending') throw new Error('Order is not pending');

  await run('BEGIN TRANSACTION');

  try {
    // Use current exchange rate if not provided (fallback to DB)
    let rate = exchangeRate;
    if (!rate || rate <= 0) {
      const rateRow = await getCurrentExchangeRate();
      rate = rateRow.currentRate?.rate ?? 1500;
    }

    // Calculate profit: for each item, look up avgCostUSD â†’ convert to IQD
    let totalCostIQD = 0;
    const itemCosts: Array<{ variantId: number; unitCostIQD: number }> = [];

    for (const item of order.items) {
      const variant = await get<{ avgCostUSD: number }>(
        'SELECT avgCostUSD FROM product_variants WHERE id = ?',
        [item.variantId],
      );
      const unitCostIQD = (variant?.avgCostUSD ?? 0) * rate;
      totalCostIQD += unitCostIQD * item.quantity;
      itemCosts.push({ variantId: item.variantId, unitCostIQD });
    }

    const profitIQD = order.totalIQD - totalCostIQD;

    // Create a real sale with correct profitIQD
    const saleDate = new Date().toISOString();
    const saleResult = await runWithResult(
      `INSERT INTO sales (branchId, cashierId, customerId, saleDate, subtotalIQD, discountIQD, totalIQD, paymentMethod, profitIQD)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'online', ?)`,
      [
        order.branchId,
        userId,
        order.customerId ?? null,
        saleDate,
        order.subtotalIQD,
        order.discountIQD,
        order.totalIQD,
        profitIQD,
      ],
    );
    const saleId = saleResult.lastID;

    for (const item of order.items) {
      const costEntry = itemCosts.find((c) => c.variantId === item.variantId);
      const unitCostIQDAtSale = costEntry?.unitCostIQD ?? null;

      await run(
        `INSERT INTO sale_items (saleId, variantId, quantity, unitPriceIQD, unitCostIQDAtSale, lineTotalIQD)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [saleId, item.variantId, item.quantity, item.unitPriceIQD, unitCostIQDAtSale, item.lineTotalIQD],
      );
      // Deduct stock
      await run(
        `UPDATE variant_stock SET quantity = quantity - ?
         WHERE variantId = ? AND branchId = ?`,
        [item.quantity, item.variantId, order.branchId],
      );
    }

    await run(
      `UPDATE online_orders SET status = 'confirmed', confirmedAt = CURRENT_TIMESTAMP, saleId = ? WHERE id = ?`,
      [saleId, orderId],
    );

    await run('COMMIT');
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }

  await logActivity(userId, 'confirm', 'online_order', orderId);
  return (await getOnlineOrderById(orderId))!;
}

export async function rejectOnlineOrder(
  orderId: number,
  userId: number,
  reason?: string,
): Promise<OnlineOrder> {
  const order = await getOnlineOrderById(orderId);
  if (!order) throw new Error('Online order not found');
  if (order.status !== 'pending') throw new Error('Order is not pending');

  await run(
    `UPDATE online_orders SET status = 'rejected', rejectedAt = CURRENT_TIMESTAMP, rejectionReason = ? WHERE id = ?`,
    [reason ?? null, orderId],
  );

  await logActivity(userId, 'reject', 'online_order', orderId);
  return (await getOnlineOrderById(orderId))!;
}

export async function updateOnlineOrder(
  orderId: number,
  input: OnlineOrderInput,
  userId: number,
): Promise<OnlineOrder> {
  const order = await getOnlineOrderById(orderId);
  if (!order) throw new Error('Online order not found');
  if (order.status !== 'pending') throw new Error('Cannot edit non-pending orders');

  await run('BEGIN TRANSACTION');
  try {
    // Update main order
    await run(
      `UPDATE online_orders 
       SET customerName = ?, customerPhone = ?, source = ?, note = ?, 
           subtotalIQD = ?, discountIQD = ?, totalIQD = ?
       WHERE id = ?`,
      [
        input.customerName ?? null,
        input.customerPhone ?? null,
        input.source,
        input.note ?? null,
        input.subtotalIQD,
        input.discountIQD,
        input.totalIQD,
        orderId,
      ]
    );

    // Replace items
    await run(`DELETE FROM online_order_items WHERE orderId = ?`, [orderId]);

    for (const item of input.items) {
      await run(
        `INSERT INTO online_order_items (orderId, variantId, quantity, unitPriceIQD, lineTotalIQD)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.variantId, item.quantity, item.unitPriceIQD, item.lineTotalIQD],
      );
    }

    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }

  await logActivity(userId, 'update', 'online_order', orderId);
  return (await getOnlineOrderById(orderId))!;
}

export async function deleteOnlineOrder(
  orderId: number,
  userId: number,
): Promise<void> {
  const order = await getOnlineOrderById(orderId);
  if (!order) throw new Error('Online order not found');
  if (order.status !== 'pending') throw new Error('Cannot delete non-pending orders');

  await run('BEGIN TRANSACTION');
  try {
    await run(`DELETE FROM online_order_items WHERE orderId = ?`, [orderId]);
    await run(`DELETE FROM online_orders WHERE id = ?`, [orderId]);
    await run('COMMIT');
  } catch (err) {
    await run('ROLLBACK');
    throw err;
  }

  await logActivity(userId, 'delete', 'online_order', orderId);
}

// ─── Employees CRUD & Reports ──────────────────────────────────────────────────

export async function listEmployees(includeInactive = false): Promise<Employee[]> {
  const query = includeInactive
    ? 'SELECT * FROM employees ORDER BY name ASC'
    : 'SELECT * FROM employees WHERE isActive = 1 ORDER BY name ASC';
  const rows = await all<any>(query);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone ?? null,
    isActive: r.isActive === 1,
    createdAt: r.createdAt,
  }));
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  const result = await runWithResult(
    'INSERT INTO employees (name, phone, isActive) VALUES (?, ?, ?)',
    [input.name, input.phone ?? null, input.isActive !== false ? 1 : 0]
  );
  const employeeId = result.lastID as number;
  const newEmp = await get<any>('SELECT * FROM employees WHERE id = ?', [employeeId]);
  if (!newEmp) throw new Error('Failed to retrieve created employee');
  return {
    id: newEmp.id,
    name: newEmp.name,
    phone: newEmp.phone ?? null,
    isActive: newEmp.isActive === 1,
    createdAt: newEmp.createdAt,
  };
}

export async function updateEmployee(id: number, input: Partial<EmployeeInput>): Promise<Employee> {
  const existing = await get<any>('SELECT * FROM employees WHERE id = ?', [id]);
  if (!existing) throw new Error('Employee not found');

  const name = input.name !== undefined ? input.name : existing.name;
  const phone = input.phone !== undefined ? input.phone : existing.phone;
  const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.isActive;

  await run(
    'UPDATE employees SET name = ?, phone = ?, isActive = ? WHERE id = ?',
    [name, phone, isActive, id]
  );

  const updated = await get<any>('SELECT * FROM employees WHERE id = ?', [id]);
  return {
    id: updated.id,
    name: updated.name,
    phone: updated.phone ?? null,
    isActive: updated.isActive === 1,
    createdAt: updated.createdAt,
  };
}

export async function deleteEmployee(id: number): Promise<boolean> {
  const linkedSales = await get<{ count: number }>(
    'SELECT COUNT(*) as count FROM sales WHERE employeeId = ?',
    [id]
  );

  if (linkedSales && linkedSales.count > 0) {
    // Has sales, soft delete (mark as inactive)
    await run('UPDATE employees SET isActive = 0 WHERE id = ?', [id]);
    return false; // Soft deleted
  } else {
    // No sales, hard delete
    await run('DELETE FROM employees WHERE id = ?', [id]);
    return true; // Hard deleted
  }
}

export interface EmployeeSalesReportEntry {
  employeeId: number | null;
  employeeName: string;
  salesCount: number;
  itemsSold: number;
  totalRevenueIQD: number;
}

export async function getEmployeeSalesReport(startDate: string, endDate: string): Promise<EmployeeSalesReportEntry[]> {
  const query = `
    SELECT 
      s.employeeId,
      IFNULL(e.name, 'Unassigned') as employeeName,
      COUNT(s.id) as salesCount,
      IFNULL(SUM((SELECT SUM(si.quantity) FROM sale_items si WHERE si.saleId = s.id)), 0) as itemsSold,
      IFNULL(SUM(s.totalIQD), 0) as totalRevenueIQD
    FROM sales s
    LEFT JOIN employees e ON e.id = s.employeeId
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
    GROUP BY s.employeeId, e.name
    ORDER BY totalRevenueIQD DESC
  `;
  return all<EmployeeSalesReportEntry>(query, [startDate, endDate]);
}

export interface EmployeeDetailedSalesEntry {
  saleId: number;
  saleDate: string;
  productName: string;
  sku: string;
  color: string | null;
  size: string | null;
  quantity: number;
  unitPriceIQD: number;
  lineTotalIQD: number;
  subtotalIQD: number;
  discountIQD: number;
  totalIQD: number;
}

export async function getEmployeeDetailedSales(
  employeeId: number | null,
  startDate: string,
  endDate: string
): Promise<EmployeeDetailedSalesEntry[]> {
  const employeeFilter = employeeId === null ? 's.employeeId IS NULL' : 's.employeeId = ?';
  const params = employeeId === null ? [startDate, endDate] : [employeeId, startDate, endDate];
  
  const query = `
    SELECT 
      s.id as saleId,
      s.saleDate,
      p.name as productName,
      pv.sku,
      pv.color,
      pv.size,
      si.quantity,
      si.unitPriceIQD,
      si.lineTotalIQD,
      s.subtotalIQD,
      s.discountIQD,
      s.totalIQD
    FROM sale_items si
    JOIN sales s ON s.id = si.saleId
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN products p ON p.id = pv.productId
    WHERE ${employeeFilter}
      AND date(s.saleDate) BETWEEN date(?) AND date(?)
    ORDER BY s.saleDate DESC, si.id ASC
  `;
  return all<EmployeeDetailedSalesEntry>(query, params);
}
