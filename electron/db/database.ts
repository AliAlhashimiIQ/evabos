import path from 'path';
import crypto from 'crypto';
import sqlite3 from 'sqlite3';
import { app } from 'electron';
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
  SaleInput,
  SaleItem,
  SaleItemInput,
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
} from './types';

sqlite3.verbose();

type SqlValue = string | number | null;

let dbInstance: sqlite3.Database | null = null;

const resolveDbPath = (): string => {
  if (!app.isReady()) {
    throw new Error('Attempted to resolve DB path before Electron app was ready');
  }

  return path.join(app.getPath('userData'), 'eva-pos.db');
};

const connect = (): sqlite3.Database => {
  const database = new sqlite3.Database(
    resolveDbPath(),
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  );

  database.on('error', (err) => {
    console.error('[sqlite] unexpected error', err);
  });

  database.exec('PRAGMA foreign_keys = ON;');

  return database;
};

const getDb = (): sqlite3.Database => {
  if (!app.isReady()) {
    throw new Error('Attempted to access database before Electron app was ready');
  }

  if (!dbInstance) {
    dbInstance = connect();
  }

  return dbInstance;
};

const run = (sql: string, params: SqlValue[] = []): Promise<void> => {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
};

const runWithResult = (sql: string, params: SqlValue[] = []): Promise<sqlite3.RunResult> => {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (this: sqlite3.RunResult, err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
};

const get = <T = unknown>(sql: string, params: SqlValue[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row as T | undefined);
    });
  });
};

const all = <T = unknown>(sql: string, params: SqlValue[] = []): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows as T[]);
    });
  });
};

const hashPassword = (input: string): string =>
  crypto.createHash('sha256').update(input).digest('hex');

const slugify = (value?: string | null): string =>
  (value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);

const generateSku = (productName: string, color?: string | null, size?: string | null): string => {
  const nameSegment = slugify(productName).slice(0, 4);
  const colorSegment = slugify(color).slice(0, 2) || 'XX';
  const sizeSegment = slugify(size).slice(0, 2) || 'OS';
  const randomSegment = Math.floor(Math.random() * 999)
    .toString()
    .padStart(3, '0');
  return `EVA-${nameSegment}${colorSegment}${sizeSegment}-${randomSegment}`;
};

const generateBarcode = (): string => {
  let payload = '';
  for (let i = 0; i < 12; i += 1) {
    payload += Math.floor(Math.random() * 10).toString();
  }
  const digits = payload.split('').map((d) => parseInt(d, 10));
  const sum =
    digits.reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0) % 10;
  const checkDigit = (10 - sum) % 10;
  return payload + checkDigit.toString();
};

const createTables = async (): Promise<void> => {
  await run(`
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      currency TEXT DEFAULT 'IQD',
      isActive INTEGER DEFAULT 1
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      branchId INTEGER,
      isLocked INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rate REAL NOT NULL,
      effectiveDate TEXT NOT NULL,
      note TEXT,
      branchId INTEGER,
      FOREIGN KEY (branchId) REFERENCES branches(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contactName TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      isActive INTEGER DEFAULT 1
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      baseCode TEXT,
      category TEXT,
      description TEXT,
      defaultSupplierId INTEGER,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (defaultSupplierId) REFERENCES suppliers(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER NOT NULL,
      size TEXT,
      color TEXT,
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT UNIQUE,
      defaultPriceIQD REAL NOT NULL,
      purchaseCostUSD REAL DEFAULT 0,
      avgCostUSD REAL DEFAULT 0,
      lastPurchaseCostUSD REAL DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS variant_stock (
      variantId INTEGER NOT NULL,
      branchId INTEGER NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      lowStockThreshold REAL NOT NULL DEFAULT 1,
      PRIMARY KEY (variantId, branchId),
      FOREIGN KEY (variantId) REFERENCES product_variants(id) ON DELETE CASCADE,
      FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS inventory_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variantId INTEGER NOT NULL,
      branchId INTEGER NOT NULL,
      deltaQuantity REAL NOT NULL,
      reason TEXT NOT NULL,
      note TEXT,
      adjustedBy INTEGER,
      adjustedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (variantId) REFERENCES product_variants(id),
      FOREIGN KEY (branchId) REFERENCES branches(id),
      FOREIGN KEY (adjustedBy) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      totalVisits INTEGER NOT NULL DEFAULT 0,
      totalSpentIQD REAL NOT NULL DEFAULT 0,
      lastVisitAt TEXT,
      loyaltyPoints REAL NOT NULL DEFAULT 0
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplierId INTEGER NOT NULL,
      branchId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      reference TEXT,
      orderedAt TEXT,
      receivedAt TEXT,
      subtotalUSD REAL NOT NULL DEFAULT 0,
      shippingUSD REAL NOT NULL DEFAULT 0,
      taxesUSD REAL NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (supplierId) REFERENCES suppliers(id),
      FOREIGN KEY (branchId) REFERENCES branches(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchaseOrderId INTEGER NOT NULL,
      variantId INTEGER NOT NULL,
      quantity REAL NOT NULL,
      costUSD REAL NOT NULL,
      costIQD REAL NOT NULL,
      FOREIGN KEY (purchaseOrderId) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (variantId) REFERENCES product_variants(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branchId INTEGER NOT NULL,
      cashierId INTEGER NOT NULL,
      customerId INTEGER,
      saleDate TEXT NOT NULL,
      subtotalIQD REAL NOT NULL,
      discountIQD REAL NOT NULL DEFAULT 0,
      totalIQD REAL NOT NULL,
      paymentMethod TEXT,
      profitIQD REAL DEFAULT 0,
      FOREIGN KEY (branchId) REFERENCES branches(id),
      FOREIGN KEY (cashierId) REFERENCES users(id),
      FOREIGN KEY (customerId) REFERENCES customers(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      saleId INTEGER NOT NULL,
      variantId INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unitPriceIQD REAL NOT NULL,
      unitCostIQDAtSale REAL,
      lineTotalIQD REAL NOT NULL,
      FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (variantId) REFERENCES product_variants(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      saleId INTEGER,
      branchId INTEGER NOT NULL,
      processedBy INTEGER NOT NULL,
      customerId INTEGER,
      reason TEXT,
      refundAmountIQD REAL NOT NULL,
      type TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (saleId) REFERENCES sales(id),
      FOREIGN KEY (branchId) REFERENCES branches(id),
      FOREIGN KEY (processedBy) REFERENCES users(id),
      FOREIGN KEY (customerId) REFERENCES customers(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      returnId INTEGER NOT NULL,
      saleItemId INTEGER,
      variantId INTEGER NOT NULL,
      quantity REAL NOT NULL,
      amountIQD REAL NOT NULL,
      FOREIGN KEY (returnId) REFERENCES returns(id) ON DELETE CASCADE,
      FOREIGN KEY (saleItemId) REFERENCES sale_items(id),
      FOREIGN KEY (variantId) REFERENCES product_variants(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branchId INTEGER NOT NULL,
      expenseDate TEXT NOT NULL,
      amountIQD REAL NOT NULL,
      category TEXT NOT NULL,
      note TEXT,
      enteredBy INTEGER,
      FOREIGN KEY (branchId) REFERENCES branches(id),
      FOREIGN KEY (enteredBy) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      action TEXT NOT NULL,
      entity TEXT,
      entityId INTEGER,
      metadata TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
};

const seedInitialData = async (): Promise<void> => {
  const existingBranch = await get<{ id: number }>(
    'SELECT id FROM branches WHERE name = ? LIMIT 1',
    ['EVA Main'],
  );

  let branchId = existingBranch?.id;

  if (!branchId) {
    await run(
      `
      INSERT INTO branches (name, address, phone)
      VALUES (?, ?, ?)
    `,
      ['EVA Main', 'Baghdad, Iraq', '+964-000-0000'],
    );

    const created = await get<{ id: number }>(
      'SELECT id FROM branches WHERE name = ? ORDER BY id DESC LIMIT 1',
      ['EVA Main'],
    );

    branchId = created?.id;
  }

  const adminUser = await get<{ id: number }>(
    'SELECT id FROM users WHERE username = ? LIMIT 1',
    ['admin'],
  );

  if (!adminUser && branchId) {
    await run(
      `
      INSERT INTO users (username, passwordHash, role, branchId)
      VALUES (?, ?, ?, ?)
    `,
      ['admin', hashPassword('admin123'), 'admin', branchId],
    );
  }

  const hasExchangeRate = await get<{ count: number }>(
    'SELECT COUNT(*) as count FROM exchange_rates',
  );

  if (!hasExchangeRate || !hasExchangeRate.count) {
    await run(
      `
      INSERT INTO exchange_rates (rate, effectiveDate, note)
      VALUES (?, ?, ?)
    `,
      [1500, new Date().toISOString(), 'Initial rate'],
    );
  }
};

export async function initDatabase(): Promise<void> {
  await createTables();
  await seedInitialData();
}

export interface SettingRow {
  key: string;
  value: string;
}

const activeSessions = new Map<string, UserSession>();
let posLocked = false;
let posLockedBy: number | null = null;

export async function getSetting(key: string): Promise<string | null> {
  const row = await get<SettingRow>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await run(
    `
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `,
    [key, value],
  );
}

export async function getAllSettings(): Promise<SettingRow[]> {
  return all<SettingRow>('SELECT key, value FROM settings ORDER BY key ASC');
}

export async function closeDatabase(): Promise<void> {
  if (!dbInstance) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    dbInstance?.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

  dbInstance = null;
}

interface ProductVariantRow {
  variantId: number;
  productId: number;
  productName: string;
  category?: string | null;
  baseCode?: string | null;
  size?: string | null;
  color?: string | null;
  sku: string;
  barcode?: string | null;
  defaultPriceIQD: number;
  purchaseCostUSD: number;
  avgCostUSD: number;
  lastPurchaseCostUSD: number;
  variantActive: number;
  stockOnHand: number;
}

const mapVariantRow = (row: ProductVariantRow): Product => ({
  id: row.variantId,
  productId: row.productId,
  name: row.productName,
  productName: row.productName,
  baseCode: row.baseCode ?? null,
  category: row.category ?? null,
  size: row.size ?? null,
  color: row.color ?? null,
  sku: row.sku,
  barcode: row.barcode ?? null,
  defaultPriceIQD: row.defaultPriceIQD ?? 0,
  salePriceIQD: row.defaultPriceIQD ?? 0,
  purchaseCostUSD: row.purchaseCostUSD ?? 0,
  avgCostUSD: row.avgCostUSD ?? 0,
  lastPurchaseCostUSD: row.lastPurchaseCostUSD ?? 0,
  isActive: Boolean(row.variantActive),
  stockOnHand: row.stockOnHand ?? 0,
});

const mapSaleRow = (row: any): Sale => ({
  id: row.id,
  branchId: row.branchId,
  cashierId: row.cashierId,
  customerId: row.customerId ?? null,
  saleDate: row.saleDate,
  subtotalIQD: row.subtotalIQD ?? 0,
  discountIQD: row.discountIQD ?? 0,
  totalIQD: row.totalIQD ?? 0,
  paymentMethod: row.paymentMethod ?? null,
  profitIQD: row.profitIQD ?? null,
  items: [],
});

const mapSaleItemRow = (row: any): SaleItem => ({
  id: row.id,
  saleId: row.saleId,
  variantId: row.variantId,
  quantity: row.quantity,
  unitPriceIQD: row.unitPriceIQD,
  unitCostIQDAtSale: row.unitCostIQDAtSale ?? null,
  lineTotalIQD: row.lineTotalIQD,
});

const mapExchangeRateRow = (row: any): ExchangeRate => ({
  id: row.id,
  rate: row.rate,
  effectiveDate: row.effectiveDate,
  note: row.note ?? null,
});

const fetchCustomerById = async (id: number): Promise<Customer | null> => {
  const result = await get<Customer>('SELECT * FROM customers WHERE id = ?', [id]);
  return result ?? null;
};

const fetchReturnById = async (id: number): Promise<ReturnResponse | null> => {
  const record = await get<ReturnResponse>(
    `
    SELECT *
    FROM returns
    WHERE id = ?
  `,
    [id],
  );

  if (!record) {
    return null;
  }

  const items = await all<ReturnItem>(
    `
    SELECT *
    FROM return_items
    WHERE returnId = ?
  `,
    [id],
  );

  return {
    ...record,
    items,
  };
};


export async function getSaleDetail(saleId: number): Promise<SaleDetail | null> {
  const sale = await get<Sale>(
    `
    SELECT *
    FROM sales
    WHERE id = ?
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
};

export const ensureVariantStockRow = async (variantId: number, branchId: number): Promise<void> => {
  await run(
    `
    INSERT OR IGNORE INTO variant_stock (variantId, branchId, quantity)
    VALUES (?, ?, 0)
  `,
    [variantId, branchId],
  );
};

const adjustVariantStockInternal = async (
  variantId: number,
  branchId: number,
  deltaQuantity: number,
  reason: string,
  note?: string,
  adjustedBy?: number | null,
): Promise<InventoryAdjustment> => {
  await ensureVariantStockRow(variantId, branchId);

  await run(
    `
    UPDATE variant_stock
    SET quantity = quantity + ?
    WHERE variantId = ? AND branchId = ?
  `,
    [deltaQuantity, variantId, branchId],
  );

  const insertResult = await runWithResult(
    `
    INSERT INTO inventory_adjustments (
      variantId, branchId, deltaQuantity, reason, note, adjustedBy
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [variantId, branchId, deltaQuantity, reason, note ?? null, adjustedBy ?? null],
  );

  const record = await get<InventoryAdjustment>(
    'SELECT * FROM inventory_adjustments WHERE id = ?',
    [insertResult.lastID],
  );

  if (!record) {
    throw new Error('Failed to record inventory adjustment');
  }

  return record;
};

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

export async function listProducts(): Promise<ProductsListResponse> {
  const rows = await all<ProductVariantRow>(
    `
    SELECT
      pv.id AS variantId,
      pv.productId,
      p.name AS productName,
      p.category,
      p.baseCode,
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
    LEFT JOIN variant_stock vs ON vs.variantId = pv.id
    GROUP BY pv.id
    ORDER BY p.name ASC, pv.color ASC, pv.size ASC
  `,
  );

  return { products: rows.map(mapVariantRow) };
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
    INSERT INTO customers (name, phone, notes, totalVisits, totalSpentIQD, loyaltyPoints)
    VALUES (?, ?, ?, 0, 0, 0)
  `,
    [input.name, input.phone ?? null, input.notes ?? null],
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
        notes = COALESCE(?, notes)
    WHERE id = ?
  `,
    [input.name ?? null, input.phone ?? null, input.notes ?? null, input.id],
  );

  const updated = await fetchCustomerById(input.id);
  if (!updated) {
    throw new Error('Failed to load updated customer');
  }

  return updated;
}

export async function listReturns(): Promise<ReturnResponse[]> {
  const records = await all<ReturnRecord>(
    `
    SELECT *
    FROM returns
    ORDER BY datetime(createdAt) DESC
    LIMIT 200
  `,
  );

  const results: ReturnResponse[] = [];
  for (const record of records) {
    const full = await fetchReturnById(record.id);
    if (full) {
      results.push(full);
    }
  }
  return results;
}

export async function createReturn(input: ReturnInput): Promise<ReturnResponse> {
  if (!input.items?.length) {
    throw new Error('Return must include at least one item.');
  }

  await run('BEGIN TRANSACTION');
  try {
    const refundAmount =
      input.refundAmountIQD ??
      input.items
        .filter((item) => item.direction !== 'exchange_in')
        .reduce((acc, item) => acc + (item.amountIQD ?? 0), 0);

    const insert = await runWithResult(
      `
      INSERT INTO returns (
        saleId,
        branchId,
        processedBy,
        customerId,
        reason,
        refundAmountIQD,
        type
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        input.saleId ?? null,
        input.branchId,
        input.processedBy,
        input.customerId ?? null,
        input.reason ?? null,
        refundAmount,
        input.type,
      ],
    );

    const returnId = insert.lastID as number;

    for (const item of input.items) {
      const direction = item.direction ?? 'return';
      await run(
        `
        INSERT INTO return_items (
          returnId,
          saleItemId,
          variantId,
          quantity,
          amountIQD
        ) VALUES (?, ?, ?, ?, ?)
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

export async function listExpenses(): Promise<Expense[]> {
  return all<Expense>(
    `
    SELECT *
    FROM expenses
    ORDER BY datetime(expenseDate) DESC
    LIMIT 500
  `,
  );
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const result = await runWithResult(
    `
    INSERT INTO expenses (branchId, expenseDate, amountIQD, category, note, enteredBy)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [
      input.branchId,
      input.expenseDate ?? new Date().toISOString(),
      input.amountIQD,
      input.category,
      input.note ?? null,
      input.enteredBy ?? null,
    ],
  );

  const created = await get<Expense>('SELECT * FROM expenses WHERE id = ?', [result.lastID]);
  if (!created) {
    throw new Error('Failed to load created expense');
  }
  return created;
}

export async function deleteExpense(id: number): Promise<void> {
  await run('DELETE FROM expenses WHERE id = ?', [id]);
}

export async function getExpenseSummary(range: DateRange): Promise<ExpenseSummary> {
  const totalRow = await get<{ total: number }>(
    `
    SELECT IFNULL(SUM(amountIQD), 0) as total
    FROM expenses
    WHERE date(expenseDate) BETWEEN date(?) AND date(?)
  `,
    [range.startDate, range.endDate],
  );

  const categories = await all<{ category: string; amountIQD: number }>(
    `
    SELECT category, IFNULL(SUM(amountIQD), 0) as amountIQD
    FROM expenses
    WHERE date(expenseDate) BETWEEN date(?) AND date(?)
    GROUP BY category
  `,
    [range.startDate, range.endDate],
  );

  return {
    totalIQD: totalRow?.total ?? 0,
    categories,
  };
}

export async function getAdvancedReports(range: DateRange): Promise<AdvancedReports> {
  const dailySales = await all<DailySalesEntry>(
    `
    SELECT
      date(saleDate) as date,
      IFNULL(SUM(totalIQD), 0) as totalIQD,
      COUNT(*) as orders,
      CASE WHEN COUNT(*) = 0 THEN 0 ELSE IFNULL(SUM(totalIQD), 0) / COUNT(*) END as avgTicket
    FROM sales
    WHERE date(saleDate) BETWEEN date(?) AND date(?)
    GROUP BY date(saleDate)
    ORDER BY date(saleDate)
  `,
    [range.startDate, range.endDate],
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
    GROUP BY p.name
    ORDER BY quantity DESC
    LIMIT 10
  `,
    [range.startDate, range.endDate],
  );

  const salesBySize = await all<NamedMetric>(
    `
    SELECT
      COALESCE(pv.size, 'Unknown') as name,
      IFNULL(SUM(si.quantity), 0) as quantity,
      IFNULL(SUM(si.lineTotalIQD), 0) as amountIQD
    FROM sale_items si
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN sales s ON s.id = si.saleId
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
    GROUP BY pv.size
  `,
    [range.startDate, range.endDate],
  );

  const salesByColor = await all<NamedMetric>(
    `
    SELECT
      COALESCE(pv.color, 'Unknown') as name,
      IFNULL(SUM(si.quantity), 0) as quantity,
      IFNULL(SUM(si.lineTotalIQD), 0) as amountIQD
    FROM sale_items si
    JOIN product_variants pv ON pv.id = si.variantId
    JOIN sales s ON s.id = si.saleId
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
    GROUP BY pv.color
  `,
    [range.startDate, range.endDate],
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

  const revenueRow = await get<{ revenue: number }>(
    `
    SELECT IFNULL(SUM(totalIQD), 0) as revenue
    FROM sales
    WHERE date(saleDate) BETWEEN date(?) AND date(?)
  `,
    [range.startDate, range.endDate],
  );

  const costRow = await get<{ cost: number }>(
    `
    SELECT IFNULL(SUM(quantity * IFNULL(unitCostIQDAtSale, 0)), 0) as cost
    FROM sale_items si
    JOIN sales s ON s.id = si.saleId
    WHERE date(s.saleDate) BETWEEN date(?) AND date(?)
  `,
    [range.startDate, range.endDate],
  );

  const expensesRow = await get<{ total: number }>(
    `
    SELECT IFNULL(SUM(amountIQD), 0) as total
    FROM expenses
    WHERE date(expenseDate) BETWEEN date(?) AND date(?)
  `,
    [range.startDate, range.endDate],
  );

  const inventoryValueRow = await get<{ value: number }>(
    `
    SELECT IFNULL(SUM(vs.quantity * pv.avgCostUSD * 1500), 0) as value
    FROM variant_stock vs
    JOIN product_variants pv ON pv.id = vs.variantId
  `,
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
    ORDER BY vs.quantity ASC
    LIMIT 20
  `,
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

  return {
    dailySales,
    bestSellingItems,
    salesBySize,
    salesByColor,
    topCustomers,
    profitAnalysis: {
      revenueIQD: revenueRow?.revenue ?? 0,
      costIQD: costRow?.cost ?? 0,
      expensesIQD: expensesRow?.total ?? 0,
      netProfitIQD: (revenueRow?.revenue ?? 0) - (costRow?.cost ?? 0) - (expensesRow?.total ?? 0),
    },
    inventoryValue: inventoryValueRow?.value ?? 0,
    lowStock,
    expensesVsSales,
    activityLogs,
  };
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
    WHERE si.saleId IN (${placeholders})
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

  const results: PurchaseOrderWithItems[] = [];
  for (const order of orders) {
    const fullOrder = await fetchPurchaseOrderById(order.id);
    if (fullOrder) {
      results.push(fullOrder);
    }
  }

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
      INSERT INTO purchase_orders (
        supplierId,
        branchId,
        status,
        reference,
        orderedAt,
        subtotalUSD,
        shippingUSD,
        taxesUSD,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        INSERT INTO purchase_order_items (
          purchaseOrderId,
          variantId,
          quantity,
          costUSD,
          costIQD
        ) VALUES (?, ?, ?, ?, ?)
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
        `PO #${order.id}`,
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
      INSERT INTO products (name, baseCode, category, description, defaultSupplierId)
      VALUES (?, ?, ?, ?, ?)
    `,
      [
        product.name,
        product.code ?? null,
        product.category ?? null,
        product.description ?? null,
        product.supplierId ?? null,
      ],
    );

    const productId = productResult.lastID as number;
    const sku = generateSku(product.name, product.color, product.size);
    const barcode = product.barcode && product.barcode.trim().length > 0 ? product.barcode : generateBarcode();

    const variantResult = await runWithResult(
      `
      INSERT INTO product_variants (
        productId, size, color, sku, barcode,
        defaultPriceIQD, purchaseCostUSD, avgCostUSD, lastPurchaseCostUSD
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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

export async function createSale(input: SaleInput): Promise<Sale> {
  if (!input.branchId || !input.cashierId) {
    throw new Error('branchId and cashierId are required for a sale');
  }

  await run('BEGIN TRANSACTION');

  try {
    const saleResult = await runWithResult(
      `
      INSERT INTO sales (
        branchId, cashierId, customerId, saleDate,
        subtotalIQD, discountIQD, totalIQD, paymentMethod, profitIQD
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        input.branchId,
        input.cashierId,
        input.customerId ?? null,
        input.saleDate,
        input.subtotalIQD,
        input.discountIQD ?? 0,
        input.totalIQD,
        input.paymentMethod ?? null,
        input.items.reduce(
          (acc, item) => acc + (item.unitPriceIQD - (item.unitCostIQDAtSale ?? 0)) * item.quantity,
          0,
        ),
      ],
    );

    const saleId = saleResult.lastID as number;

    for (const item of input.items) {
      await run(
        `
        INSERT INTO sale_items (
          saleId, variantId, quantity,
          unitPriceIQD, unitCostIQDAtSale, lineTotalIQD
        )
        VALUES (?, ?, ?, ?, ?, ?)
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
        `Sale #${saleId}`,
        input.cashierId,
      );
    }

    await run('COMMIT');

    if (input.customerId) {
      await recordCustomerPurchase(input.customerId, input.totalIQD);
    }

    const items = await all<SaleItem>(
      `
      SELECT *
      FROM sale_items
      WHERE saleId = ?
      ORDER BY id ASC
    `,
      [saleId],
    );

    return {
      ...mapSaleRow({
        id: saleId,
        ...input,
      }),
      items: items.map(mapSaleItemRow),
    };
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
  const salesRows = await all<SaleRow>(
    `
    SELECT *
    FROM sales
    WHERE date(saleDate) BETWEEN date(?) AND date(?)
    ORDER BY saleDate ASC
  `,
    [range.startDate, range.endDate],
  );

  if (!salesRows.length) {
    return { sales: [] };
  }

  const saleIds = salesRows.map((s) => s.id);
  const placeholders = saleIds.map(() => '?').join(', ');
  const itemsRows = await all<SaleItem>(
    `
    SELECT *
    FROM sale_items
    WHERE saleId IN (${placeholders})
    ORDER BY saleId ASC, id ASC
  `,
    saleIds,
  );

  const itemsBySale = new Map<number, SaleItem[]>();
  for (const row of itemsRows) {
    const saleItems = itemsBySale.get(row.saleId) ?? [];
    saleItems.push(mapSaleItemRow(row));
    itemsBySale.set(row.saleId, saleItems);
  }

  const sales: Sale[] = salesRows.map((row) => ({
    ...mapSaleRow(row),
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

export async function getCurrentExchangeRate(): Promise<ExchangeRateResponse> {
  const row = await get<ExchangeRateRow>(
    `
    SELECT *
    FROM exchange_rates
    ORDER BY datetime(effectiveDate) DESC, id DESC
    LIMIT 1
  `,
  );

  return {
    currentRate: row ? mapExchangeRateRow(row) : null,
  };
}

export async function updateExchangeRate(
  input: ExchangeRateInput,
): Promise<ExchangeRateResponse> {
  const effectiveDate = input.effectiveDate ?? new Date().toISOString();
  await run(
    `
    INSERT INTO exchange_rates (rate, effectiveDate, note)
    VALUES (?, ?, ?)
  `,
    [input.rate, effectiveDate, input.note ?? null],
  );

  return getCurrentExchangeRate();
}

export async function ensureAdminUser(): Promise<void> {
  // Get or create branch
  let branchId = (await get<{ id: number }>('SELECT id FROM branches WHERE name = ? LIMIT 1', ['EVA Main']))?.id;

  if (!branchId) {
    await run(
      `
      INSERT INTO branches (name, address, phone)
      VALUES (?, ?, ?)
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
    await run(
      `
      INSERT INTO users (username, passwordHash, role, branchId)
      VALUES (?, ?, ?, ?)
    `,
      ['admin', hashPassword('admin123'), 'admin', branchId],
    );
    console.log('[db] Admin user created: admin / admin123');
  } else {
    // Reset admin password to ensure it's correct
    await run(
      `
      UPDATE users
      SET passwordHash = ?, role = 'admin'
      WHERE username = 'admin'
    `,
      [hashPassword('admin123')],
    );
    console.log('[db] Admin user password reset: admin / admin123');
  }
}

export async function login(username: string, password: string): Promise<LoginResponse | null> {
  // Ensure admin user exists before login attempt
  if (username === 'admin') {
    try {
      await ensureAdminUser();
    } catch (err) {
      console.error('[db] Failed to ensure admin user:', err);
    }
  }

  const user = await get<{ id: number; passwordHash: string; role: string; branchId: number | null }>(
    `
    SELECT id, passwordHash, role, branchId
    FROM users
    WHERE username = ?
    `,
    [username],
  );

  if (!user) {
    return null;
  }

  const passwordHash = hashPassword(password);
  if (passwordHash !== user.passwordHash) {
    return null;
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
  };
}

export async function logout(token: string): Promise<void> {
  const session = activeSessions.get(token);
  if (session) {
    await logActivity(session.userId, 'logout', 'user', session.userId);
    activeSessions.delete(token);
  }
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
    INSERT INTO activity_logs (userId, action, entity, entityId, metadata)
    VALUES (?, ?, ?, ?, ?)
  `,
    [userId, action, entity ?? null, entityId ?? null, metadata ? JSON.stringify(metadata) : null],
  );
}

export async function listActivityLogs(limit = 200): Promise<ActivityLogEntry[]> {
  return all<ActivityLogEntry>(
    `
    SELECT id, userId, action, entity, entityId, createdAt
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

export function unlockPos(userId: number): void {
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

  const passwordHash = hashPassword(input.password);
  const result = await runWithResult(
    `
    INSERT INTO users (username, passwordHash, role, branchId)
    VALUES (?, ?, ?, ?)
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
    params.push(hashPassword(input.password));
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
  await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

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
    INSERT INTO branches (name, address, phone, currency)
    VALUES (?, ?, ?, ?)
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
  await run(`UPDATE branches SET ${updates.join(', ')} WHERE id = ?`, params);

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
    await run(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  // Return updated product
  const productsResponse = await listProducts();
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
  await run(`UPDATE product_variants SET ${updates.join(', ')} WHERE id = ?`, params);
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
      SELECT IFNULL(SUM(refundAmountIQD), 0) as totalReturnsIQD
      FROM returns
      WHERE date(createdAt) >= date(?) AND date(createdAt) <= date(?) AND branchId = ?
    `
    : `
      SELECT IFNULL(SUM(refundAmountIQD), 0) as totalReturnsIQD
      FROM returns
      WHERE date(createdAt) >= date(?) AND date(createdAt) <= date(?)
    `;

  const todayReturnsParams = branchId ? [startDate, endDate, branchId] : [startDate, endDate];
  const todayReturnsRow = await get<{ totalReturnsIQD: number }>(
    todayReturnsQuery,
    todayReturnsParams,
  );

  const totalReturnsIQD = todayReturnsRow?.totalReturnsIQD ?? 0;

  // Calculate NET sales (sales minus returns)
  const grossSalesIQD = todaySalesRow?.totalIQD ?? 0;
  const grossProfitIQD = todaySalesRow?.profitIQD ?? 0;
  const netSalesIQD = grossSalesIQD - totalReturnsIQD;
  const netProfitIQD = grossProfitIQD - totalReturnsIQD; // Returns reduce profit

  const todaySales = {
    count: todaySalesRow?.count ?? 0,
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

  return {
    todaySales,
    todayExpenses: todayExpensesRow?.total ?? 0,
    lowStockCount: lowStockRow?.count ?? 0,
    recentSales,
    lowStockItems,
  };
}

