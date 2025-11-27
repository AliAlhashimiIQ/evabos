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
  listSuppliers,
  createSupplier,
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
    'inventory:products:create',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const payload = args[0] as ProductInput;
      if (!payload || !payload.name) {
        throw new Error('Invalid product data: name is required');
      }
      return createProduct(payload);
    }),
  );

  ipcMain.handle(
    'inventory:products:update',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as ProductUpdateInput;
      const product = await updateProduct(payload);
      await (await import('../db/database')).logActivity(session.userId, 'update', 'product', product.id);
      return product;
    }),
  );

  ipcMain.handle(
    'inventory:variants:update',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as VariantUpdateInput;
      await updateVariant(payload);
      await (await import('../db/database')).logActivity(session.userId, 'update', 'variant', payload.id);
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
      return adjustVariantStock({
        variantId: payload.variantId,
        branchId: payload.branchId,
        deltaQuantity: payload.deltaQuantity,
        reason: payload.reason,
        note: payload.note,
        adjustedBy: session.userId,
      });
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
      await deleteVariant(variantId);
      await (await import('../db/database')).logActivity(session.userId, 'delete', 'variant', variantId);
      return true;
    }),
  );

  handlersRegistered = true;
}

