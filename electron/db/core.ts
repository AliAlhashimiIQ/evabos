/**
 * core.ts — Shared database primitives, connection management, and utility functions.
 * All domain modules import from this file for DB access.
 */
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import sqlite3 from 'sqlite3';
import { app } from 'electron';
import log from 'electron-log';
import { encryptCredential, isEncrypted } from './crypto';

sqlite3.verbose();

export const isDev = process.env.NODE_ENV === 'development';
export type SqlValue = string | number | null;

let dbInstance: sqlite3.Database | null = null;

const resolveDbPath = (): string => {
  if (!app.isReady()) {
    throw new Error('Attempted to resolve DB path before Electron app was ready');
  }
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    const portablePath = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'eva-pos.db');
    log.info('[db] Using PORTABLE database path:', portablePath);
    return portablePath;
  }
  const userDataPath = path.join(app.getPath('userData'), 'eva-pos.db');
  if (app.isPackaged) {
    const fs = require('fs');
    const oldDbPath = path.join(path.dirname(app.getPath('exe')), 'eva-pos.db');
    if (fs.existsSync(oldDbPath) && !fs.existsSync(userDataPath)) {
      try {
        log.info('[db] MIGRATION: Found old database at:', oldDbPath);
        const userDataDir = path.dirname(userDataPath);
        if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
        fs.copyFileSync(oldDbPath, userDataPath);
        log.info('[db] MIGRATION: Successfully migrated database to userData!');
        try { fs.renameSync(oldDbPath, oldDbPath + '.migrated'); } catch { /* ignore */ }
      } catch (migrationErr) {
        log.error('[db] MIGRATION: Failed to migrate database:', migrationErr);
      }
    }
  }
  log.info('[db] Using userData database path:', userDataPath);
  return userDataPath;
};

const connect = (): sqlite3.Database => {
  const database = new sqlite3.Database(
    resolveDbPath(),
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  );
  database.on('error', (err) => log.error('[sqlite] unexpected error', err));
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA journal_mode = WAL;');
  return database;
};

export const getDb = (): sqlite3.Database => {
  if (!app.isReady()) throw new Error('Attempted to access database before Electron app was ready');
  if (!dbInstance) {
    dbInstance = connect();
    if (app.isPackaged) {
      try {
        const dbPath = resolveDbPath();
        const documentsPath = app.getPath('documents');
        const backupDir = path.join(documentsPath, 'EVA_POS', 'Backups');
        const fs = require('fs');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}`;
        const backupPath = path.join(backupDir, `eva-pos-autobackup-${timestamp}.db`);
        fs.copyFile(dbPath, backupPath, (err: any) => {
          if (err) log.error('[AutoBackup] Failed:', err);
          else log.info('[AutoBackup] Success:', backupPath);
        });
        fs.readdir(backupDir, (err: any, files: string[]) => {
          if (err) return;
          const backups = files.filter(f => f.startsWith('eva-pos-autobackup-')).sort();
          if (backups.length > 5) {
            backups.slice(0, backups.length - 5).forEach(f => fs.unlink(path.join(backupDir, f), () => {}));
          }
        });
      } catch (err) { log.error('[AutoBackup] Error:', err); }
    }
  }
  return dbInstance;
};

// ─── SQL Primitives ────────────────────────────────────────────────────────────

export const run = (sql: string, params: SqlValue[] = []): Promise<void> =>
  new Promise((resolve, reject) => {
    getDb().run(sql, params, (err) => (err ? reject(err) : resolve()));
  });

export const runWithResult = (sql: string, params: SqlValue[] = []): Promise<sqlite3.RunResult> =>
  new Promise((resolve, reject) => {
    getDb().run(sql, params, function (this: sqlite3.RunResult, err) {
      err ? reject(err) : resolve(this);
    });
  });

export const get = <T = unknown>(sql: string, params: SqlValue[] = []): Promise<T | undefined> =>
  new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => (err ? reject(err) : resolve(row as T | undefined)));
  });

export const all = <T = unknown>(sql: string, params: SqlValue[] = []): Promise<T[]> =>
  new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
  });

// ─── Password Hashing ─────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> =>
  await bcrypt.hash(password, SALT_ROUNDS);

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  if (storedHash.length === 64 && /^[a-f0-9]+$/i.test(storedHash)) {
    const oldHash = crypto.createHash('sha256').update(password).digest('hex');
    return oldHash === storedHash;
  }
  try { return await bcrypt.compare(password, storedHash); }
  catch (err) { log.error('[auth] Password verification error:', err); return false; }
};

// ─── Utility Generators ───────────────────────────────────────────────────────

const slugify = (value?: string | null): string =>
  (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export const generateSku = (productName: string, color?: string | null, size?: string | null): string => {
  const n = slugify(productName).slice(0, 4);
  const c = slugify(color).slice(0, 2) || 'XX';
  const s = slugify(size).slice(0, 2) || 'OS';
  const r = Math.floor(Math.random() * 999).toString().padStart(3, '0');
  return `EVA-${n}${c}${s}-${r}`;
};

export const generateBarcode = (): string => {
  let payload = '';
  for (let i = 0; i < 12; i++) payload += Math.floor(Math.random() * 10).toString();
  const digits = payload.split('').map(d => parseInt(d, 10));
  const sum = digits.reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0) % 10;
  return payload + ((10 - sum) % 10).toString();
};

// ─── Schema & Init ────────────────────────────────────────────────────────────

const createTables = async (): Promise<void> => {
  await run(`CREATE TABLE IF NOT EXISTS branches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT, phone TEXT, currency TEXT DEFAULT 'IQD', isActive INTEGER DEFAULT 1)`);
  await run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL, role TEXT NOT NULL, branchId INTEGER, isLocked INTEGER DEFAULT 0, requiresPasswordChange INTEGER DEFAULT 0, createdAt TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE SET NULL)`);
  await run(`CREATE TABLE IF NOT EXISTS exchange_rates (id INTEGER PRIMARY KEY AUTOINCREMENT, rate REAL NOT NULL, effectiveDate TEXT NOT NULL, note TEXT, branchId INTEGER, FOREIGN KEY (branchId) REFERENCES branches(id))`);
  await run(`CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contactName TEXT, phone TEXT, email TEXT, address TEXT, notes TEXT, isActive INTEGER DEFAULT 1)`);
  await run(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, baseCode TEXT, category TEXT, season TEXT, description TEXT, defaultSupplierId INTEGER, isActive INTEGER DEFAULT 1, createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (defaultSupplierId) REFERENCES suppliers(id))`);
  await run(`CREATE TABLE IF NOT EXISTS product_variants (id INTEGER PRIMARY KEY AUTOINCREMENT, productId INTEGER NOT NULL, size TEXT, color TEXT, sku TEXT NOT NULL UNIQUE, barcode TEXT UNIQUE, defaultPriceIQD REAL NOT NULL, purchaseCostUSD REAL DEFAULT 0, avgCostUSD REAL DEFAULT 0, lastPurchaseCostUSD REAL DEFAULT 0, isActive INTEGER DEFAULT 1, FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE)`);
  await run(`CREATE TABLE IF NOT EXISTS variant_stock (variantId INTEGER NOT NULL, branchId INTEGER NOT NULL, quantity REAL NOT NULL DEFAULT 0, lowStockThreshold REAL NOT NULL DEFAULT 1, PRIMARY KEY (variantId, branchId), FOREIGN KEY (variantId) REFERENCES product_variants(id) ON DELETE CASCADE, FOREIGN KEY (branchId) REFERENCES branches(id) ON DELETE CASCADE)`);
  await run(`CREATE TABLE IF NOT EXISTS inventory_adjustments (id INTEGER PRIMARY KEY AUTOINCREMENT, variantId INTEGER NOT NULL, branchId INTEGER NOT NULL, deltaQuantity REAL NOT NULL, reason TEXT NOT NULL, note TEXT, adjustedBy INTEGER, adjustedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (variantId) REFERENCES product_variants(id), FOREIGN KEY (branchId) REFERENCES branches(id), FOREIGN KEY (adjustedBy) REFERENCES users(id))`);
  await run(`CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, notes TEXT, totalVisits INTEGER NOT NULL DEFAULT 0, totalSpentIQD REAL NOT NULL DEFAULT 0, lastVisitAt TEXT, loyaltyPoints REAL NOT NULL DEFAULT 0, discountPercent REAL DEFAULT NULL)`);
  await run(`CREATE TABLE IF NOT EXISTS purchase_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, supplierId INTEGER NOT NULL, branchId INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'draft', reference TEXT, orderedAt TEXT, receivedAt TEXT, subtotalUSD REAL NOT NULL DEFAULT 0, shippingUSD REAL NOT NULL DEFAULT 0, taxesUSD REAL NOT NULL DEFAULT 0, notes TEXT, FOREIGN KEY (supplierId) REFERENCES suppliers(id), FOREIGN KEY (branchId) REFERENCES branches(id))`);
  await run(`CREATE TABLE IF NOT EXISTS purchase_order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, purchaseOrderId INTEGER NOT NULL, variantId INTEGER NOT NULL, quantity REAL NOT NULL, costUSD REAL NOT NULL, costIQD REAL NOT NULL, FOREIGN KEY (purchaseOrderId) REFERENCES purchase_orders(id) ON DELETE CASCADE, FOREIGN KEY (variantId) REFERENCES product_variants(id))`);
  await run(`CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, branchId INTEGER NOT NULL, cashierId INTEGER NOT NULL, customerId INTEGER, saleDate TEXT NOT NULL, subtotalIQD REAL NOT NULL, discountIQD REAL NOT NULL DEFAULT 0, totalIQD REAL NOT NULL, paymentMethod TEXT, profitIQD REAL DEFAULT 0, FOREIGN KEY (branchId) REFERENCES branches(id), FOREIGN KEY (cashierId) REFERENCES users(id), FOREIGN KEY (customerId) REFERENCES customers(id))`);
  await run(`CREATE TABLE IF NOT EXISTS sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT, saleId INTEGER NOT NULL, variantId INTEGER NOT NULL, quantity REAL NOT NULL, unitPriceIQD REAL NOT NULL, unitCostIQDAtSale REAL, lineTotalIQD REAL NOT NULL, FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE, FOREIGN KEY (variantId) REFERENCES product_variants(id))`);
  await run(`CREATE TABLE IF NOT EXISTS returns (id INTEGER PRIMARY KEY AUTOINCREMENT, saleId INTEGER, branchId INTEGER NOT NULL, processedBy INTEGER NOT NULL, customerId INTEGER, reason TEXT, refundAmountIQD REAL NOT NULL, totalCostIQD REAL DEFAULT 0, type TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (saleId) REFERENCES sales(id), FOREIGN KEY (branchId) REFERENCES branches(id), FOREIGN KEY (processedBy) REFERENCES users(id), FOREIGN KEY (customerId) REFERENCES customers(id))`);
  await run(`CREATE TABLE IF NOT EXISTS return_items (id INTEGER PRIMARY KEY AUTOINCREMENT, returnId INTEGER NOT NULL, saleItemId INTEGER, variantId INTEGER NOT NULL, quantity REAL NOT NULL, amountIQD REAL NOT NULL, FOREIGN KEY (returnId) REFERENCES returns(id) ON DELETE CASCADE, FOREIGN KEY (saleItemId) REFERENCES sale_items(id), FOREIGN KEY (variantId) REFERENCES product_variants(id))`);
  await run(`CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, branchId INTEGER NOT NULL, expenseDate TEXT NOT NULL, amountIQD REAL NOT NULL, category TEXT NOT NULL, note TEXT, enteredBy INTEGER, FOREIGN KEY (branchId) REFERENCES branches(id), FOREIGN KEY (enteredBy) REFERENCES users(id))`);
  await run(`CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, action TEXT NOT NULL, entity TEXT, entityId INTEGER, metadata TEXT, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (userId) REFERENCES users(id))`);
  await run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  await run(`CREATE TABLE IF NOT EXISTS online_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, branchId INTEGER NOT NULL, cashierId INTEGER NOT NULL, customerId INTEGER, customerName TEXT, customerPhone TEXT, source TEXT NOT NULL DEFAULT 'other', note TEXT, status TEXT NOT NULL DEFAULT 'pending', subtotalIQD REAL NOT NULL DEFAULT 0, discountIQD REAL NOT NULL DEFAULT 0, totalIQD REAL NOT NULL DEFAULT 0, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confirmedAt TEXT, rejectedAt TEXT, rejectionReason TEXT, saleId INTEGER, FOREIGN KEY (branchId) REFERENCES branches(id), FOREIGN KEY (cashierId) REFERENCES users(id), FOREIGN KEY (customerId) REFERENCES customers(id), FOREIGN KEY (saleId) REFERENCES sales(id))`);
  await run(`CREATE TABLE IF NOT EXISTS online_order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER NOT NULL, variantId INTEGER NOT NULL, quantity REAL NOT NULL, unitPriceIQD REAL NOT NULL, lineTotalIQD REAL NOT NULL, FOREIGN KEY (orderId) REFERENCES online_orders(id) ON DELETE CASCADE, FOREIGN KEY (variantId) REFERENCES product_variants(id))`);
};

const seedInitialData = async (): Promise<void> => {
  const existingBranch = await get<{ id: number }>('SELECT id FROM branches WHERE name = ? LIMIT 1', ['EVA Main']);
  let branchId = existingBranch?.id;
  if (!branchId) {
    await run('INSERT INTO branches (name, address, phone) VALUES (?, ?, ?)', ['EVA Main', 'Baghdad, Iraq', '+964-000-0000']);
    branchId = (await get<{ id: number }>('SELECT id FROM branches WHERE name = ? ORDER BY id DESC LIMIT 1', ['EVA Main']))?.id;
  }
  const adminUser = await get<{ id: number }>('SELECT id FROM users WHERE username = ? LIMIT 1', ['admin']);
  if (!adminUser && branchId) {
    const ph = await hashPassword('admin123');
    await run('INSERT INTO users (username, passwordHash, role, branchId, requiresPasswordChange) VALUES (?, ?, ?, ?, ?)', ['admin', ph, 'admin', branchId, 1]);
  }
  const hasRate = await get<{ count: number }>('SELECT COUNT(*) as count FROM exchange_rates');
  if (!hasRate || !hasRate.count) {
    await run('INSERT INTO exchange_rates (rate, effectiveDate, note) VALUES (?, ?, ?)', [1500, new Date().toISOString(), 'Initial rate']);
  }
};

export async function initDatabase(): Promise<void> {
  await createTables();
  // Migrations
  try {
    const cols = await all<{ name: string }>('PRAGMA table_info(returns)');
    if (!cols.some(c => c.name === 'totalCostIQD')) { await run('ALTER TABLE returns ADD COLUMN totalCostIQD REAL DEFAULT 0'); log.info('[db] Added totalCostIQD'); }
    const pCols = await all<{ name: string }>('PRAGMA table_info(products)');
    if (!pCols.some(c => c.name === 'season')) { await run('ALTER TABLE products ADD COLUMN season TEXT'); log.info('[db] Added season'); }
  } catch (err) { log.error('[db] Migration failed:', err); }
  try {
    const cCols = await all<{ name: string }>('PRAGMA table_info(customers)');
    if (!cCols.some(c => c.name === 'discountPercent')) { await run('ALTER TABLE customers ADD COLUMN discountPercent REAL DEFAULT NULL'); }
  } catch (err) { log.error('[db] Customer migration failed:', err); }
  try {
    const uCols = await all<{ name: string }>('PRAGMA table_info(users)');
    if (!uCols.some(c => c.name === 'requiresPasswordChange')) {
      await run('ALTER TABLE users ADD COLUMN requiresPasswordChange INTEGER DEFAULT 0');
      await run('UPDATE users SET requiresPasswordChange = 1 WHERE username = ?', ['admin']);
    }
  } catch (err) { log.error('[db] User migration failed:', err); }
  try {
    const smtpPw = await get<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['smtp_password']);
    if (smtpPw && smtpPw.value && !isEncrypted(smtpPw.value)) {
      await run('UPDATE settings SET value = ? WHERE key = ?', [encryptCredential(smtpPw.value), 'smtp_password']);
      log.info('[db] Encrypted existing SMTP password');
    }
  } catch (err) { log.error('[db] SMTP migration failed:', err); }
  await seedInitialData();
}

export async function closeDatabase(): Promise<void> {
  if (!dbInstance) return;
  await new Promise<void>((resolve, reject) => {
    dbInstance?.close((err) => (err ? reject(err) : resolve()));
  });
  dbInstance = null;
}

// ─── Shared Mappers ───────────────────────────────────────────────────────────

import type {
  Product, Sale, SaleItem, ExchangeRate,
} from './types';

export interface ProductVariantRow {
  variantId: number; productId: number; productName: string;
  category?: string | null; season?: string | null; baseCode?: string | null;
  supplierName?: string | null; size?: string | null; color?: string | null;
  sku: string; barcode?: string | null; defaultPriceIQD: number;
  purchaseCostUSD: number; avgCostUSD: number; lastPurchaseCostUSD: number;
  variantActive: number; stockOnHand: number;
}

export const mapVariantRow = (row: ProductVariantRow): Product => ({
  id: row.variantId, productId: row.productId,
  name: row.productName, productName: row.productName,
  baseCode: row.baseCode, category: row.category, season: row.season,
  supplierName: row.supplierName, size: row.size, color: row.color,
  sku: row.sku, barcode: row.barcode,
  defaultPriceIQD: row.defaultPriceIQD, salePriceIQD: row.defaultPriceIQD,
  purchaseCostUSD: row.purchaseCostUSD, avgCostUSD: row.avgCostUSD,
  lastPurchaseCostUSD: row.lastPurchaseCostUSD,
  isActive: row.variantActive === 1, stockOnHand: row.stockOnHand,
});

export const mapSaleRow = (row: any): Sale => ({
  id: row.id, branchId: row.branchId, cashierId: row.cashierId,
  customerId: row.customerId ?? null, saleDate: row.saleDate,
  subtotalIQD: row.subtotalIQD ?? 0, discountIQD: row.discountIQD ?? 0,
  totalIQD: row.totalIQD ?? 0, paymentMethod: row.paymentMethod ?? null,
  profitIQD: row.profitIQD ?? null, items: [],
});

export const mapSaleItemRow = (row: any): SaleItem => ({
  id: row.id, saleId: row.saleId, variantId: row.variantId,
  quantity: row.quantity, unitPriceIQD: row.unitPriceIQD,
  unitCostIQDAtSale: row.unitCostIQDAtSale ?? null, lineTotalIQD: row.lineTotalIQD,
});

export const mapExchangeRateRow = (row: any): ExchangeRate => ({
  id: row.id, rate: row.rate, effectiveDate: row.effectiveDate, note: row.note ?? null,
});

// ─── Shared Stock Helpers ─────────────────────────────────────────────────────

import type { InventoryAdjustment } from './types';

export const ensureVariantStockRow = async (variantId: number, branchId: number): Promise<void> => {
  await run('INSERT OR IGNORE INTO variant_stock (variantId, branchId, quantity) VALUES (?, ?, 0)', [variantId, branchId]);
};

export const adjustVariantStockInternal = async (
  variantId: number, branchId: number, deltaQuantity: number,
  reason: string, note?: string, adjustedBy?: number | null,
): Promise<InventoryAdjustment> => {
  await ensureVariantStockRow(variantId, branchId);
  await run('UPDATE variant_stock SET quantity = quantity + ? WHERE variantId = ? AND branchId = ?', [deltaQuantity, variantId, branchId]);
  const insertResult = await runWithResult(
    'INSERT INTO inventory_adjustments (variantId, branchId, deltaQuantity, reason, note, adjustedBy) VALUES (?, ?, ?, ?, ?, ?)',
    [variantId, branchId, deltaQuantity, reason, note ?? null, adjustedBy ?? null],
  );
  const record = await get<InventoryAdjustment>('SELECT * FROM inventory_adjustments WHERE id = ?', [insertResult.lastID]);
  if (!record) throw new Error('Failed to record inventory adjustment');
  return record;
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface SettingRow { key: string; value: string; }

export async function getSetting(key: string): Promise<string | null> {
  const row = await get<SettingRow>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export async function getAllSettings(): Promise<SettingRow[]> {
  return all<SettingRow>('SELECT key, value FROM settings ORDER BY key ASC');
}
