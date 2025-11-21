import { ipcMain } from 'electron';
import { createSale, listSalesByDateRange, getSaleDetail } from '../db/database';
import type { SaleInput, DateRange } from '../db/types';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerSalesIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle(
    'sales:create',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const sale = args[0] as SaleInput;
      
      // Use branchId from sale input if provided, otherwise use session branchId, or default to 1
      const branchId = sale.branchId ?? session.branchId ?? 1;
      
      if (!branchId || branchId <= 0) {
        throw new Error('Invalid branch ID. User must be assigned to a branch.');
      }
      
      return createSale({
        ...sale,
        cashierId: session.userId,
        branchId,
      });
    }),
  );

  ipcMain.handle(
    'sales:listByDateRange',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, _session, ...args) => {
      const range = args[0] as DateRange;
      return listSalesByDateRange(range);
    }),
  );

  ipcMain.handle(
    'sales:getDetail',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, _session, ...args) => {
      const saleId = args[0] as number;
      return getSaleDetail(saleId);
    }),
  );

  handlersRegistered = true;
}

