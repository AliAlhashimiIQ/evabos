import { ipcMain } from 'electron';
import {
  listProducts,
  listProductsLegacy,
  getProductCount,
  createProduct,
  updateProduct,
  updateVariant,
  adjustVariantStock,
  deleteVariant,
  bulkUpdateProducts,
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getUniqueSeasons,
  logActivity,
} from '../db/database';
import { importProductsFromExcel } from '../db/excelImport';
import type { ProductInput, ProductUpdateInput, VariantUpdateInput, SupplierInput, PaginationParams } from '../db/types';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerInventoryIpc(): void {
  if (handlersRegistered) {
    return;
  }

  // Paginated product list
  ipcMain.handle(
    'inventory:products:list',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, _session, ...args) => {
      const params = args[0] as PaginationParams | undefined;
      if (params !== undefined) {
        // New paginated version
        return listProducts(params);
      } else {
        // Legacy - load all products
        return listProductsLegacy();
      }
    }),
  );

  // Product count (for UI pagination)
  ipcMain.handle(
    'inventory:products:count',
    requireRole(['admin', 'manager', 'cashier'])(async () => {
      return getProductCount();
    }),
  );

  ipcMain.handle(
    'inventory:products:seasons',
    requireRole(['admin', 'manager', 'cashier'])(async () => {
      return getUniqueSeasons();
    }),
  );

  ipcMain.handle(
    'inventory:products:create',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      const payload = args[0] as ProductInput;
      if (!payload || !payload.name) {
        throw new Error('Invalid product data: name is required');
      }
      const product = await createProduct(payload);
      if (session) {
        await logActivity(session.userId, 'create', 'product', product.id, {
          'الاسم': product.name,
          'الموسم': product.season || '—',
        });
      }
      return product;
    }),
  );

  ipcMain.handle(
    'inventory:products:update',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as ProductUpdateInput;
      const product = await updateProduct(payload);
      const metadata: Record<string, unknown> = {};
      if (payload.name) metadata['الاسم الجديد'] = payload.name;
      if (payload.season) metadata['الموسم'] = payload.season;
      await logActivity(session.userId, 'update', 'product', product.id, metadata);
      return product;
    }),
  );

  ipcMain.handle(
    'inventory:variants:update',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as VariantUpdateInput;
      await updateVariant(payload);
      const metadata: Record<string, unknown> = {};
      if (payload.defaultPriceIQD !== undefined) metadata['السعر الجديد'] = `${payload.defaultPriceIQD.toLocaleString()} د.ع`;
      if (payload.purchaseCostUSD !== undefined) metadata['سعر التكلفة'] = `$${payload.purchaseCostUSD}`;
      if (payload.size) metadata['المقاس'] = payload.size;
      if (payload.color) metadata['اللون'] = payload.color;
      await logActivity(session.userId, 'update', 'variant', payload.id, metadata);
      return true;
    }),
  );

  ipcMain.handle(
    'inventory:stock:adjust',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as {
        variantId: number;
        branchId: number;
        deltaQuantity: number;
        reason: string;
        note?: string;
      };
      const result = await adjustVariantStock({
        variantId: payload.variantId,
        branchId: payload.branchId,
        deltaQuantity: payload.deltaQuantity,
        reason: payload.reason,
        note: payload.note,
        adjustedBy: session.userId,
      });
      await logActivity(session.userId, 'inventory_adjust', 'variant', payload.variantId, {
        'الكمية المعدلة': `${payload.deltaQuantity > 0 ? '+' : ''}${payload.deltaQuantity}`,
        'السبب': payload.reason,
        'الملاحظات': payload.note || '—',
      });
      return result;
    }),
  );

  ipcMain.handle(
    'suppliers:list',
    requireRole(['admin', 'manager'])(async () => {
      return listSuppliers();
    }),
  );

  ipcMain.handle(
    'suppliers:create',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const payload = args[0] as SupplierInput;
      if (!payload || !payload.name) {
        throw new Error('Invalid supplier data: name is required');
      }
      return createSupplier(payload);
    }),
  );

  ipcMain.handle(
    'suppliers:update',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const id = args[0] as number;
      const payload = args[1] as SupplierInput;
      if (!payload || !payload.name) {
        throw new Error('Invalid supplier data: name is required');
      }
      return updateSupplier(id, payload);
    }),
  );

  ipcMain.handle(
    'suppliers:delete',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const supplierId = args[0] as number;
      return deleteSupplier(supplierId);
    }),
  );

  ipcMain.handle(
    'inventory:excel:import',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const { fileBuffer, branchId } = args[0] as { fileBuffer: number[] | Buffer; branchId?: number };

      // Convert array to Buffer if needed (renderer sends as array)
      let buffer: Buffer;
      if (Buffer.isBuffer(fileBuffer)) {
        buffer = fileBuffer;
      } else if (Array.isArray(fileBuffer)) {
        buffer = Buffer.from(fileBuffer);
      } else {
        throw new Error('Invalid file buffer format');
      }

      return importProductsFromExcel(buffer, branchId ?? session.branchId ?? 1);
    }),
  );

  ipcMain.handle(
    'inventory:variants:delete',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const variantId = args[0] as number;
      const db = await import('../db/database');
      const core = await import('../db/core');
      const info = await core.get<{ productName: string; size?: string; color?: string }>(
        `SELECT p.name as productName, v.size, v.color FROM product_variants v JOIN products p ON p.id = v.productId WHERE v.id = ?`,
        [variantId],
      );
      await deleteVariant(variantId);
      await db.logActivity(session.userId, 'delete', 'variant', variantId, {
        'المنتج': info ? `${info.productName} (${[info.size, info.color].filter(Boolean).join(' - ')})` : `#${variantId}`,
      });
      return true;
    }),
  );

  ipcMain.handle(
    'inventory:products:bulkUpdate',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as { productIds: number[]; season?: string | null };
      await bulkUpdateProducts(session.token, payload);
      await logActivity(session.userId, 'bulk_update', 'product', payload.productIds[0], { count: payload.productIds.length });
      return true;
    }),
  );

  handlersRegistered = true;
}

