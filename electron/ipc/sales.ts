import { ipcMain } from 'electron';
import {
  createSale,
  listSalesByDateRange,
  getSaleDetail,
  deleteSale,
  attachSaleToCustomer,
  getCurrentShiftSummary,
  closeShift,
  listShiftClosings,
} from '../db/database';
import type { SaleInput, DateRange, ShiftCloseInput } from '../db/types';
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

  ipcMain.handle(
    'sales:attachCustomer',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, _session, ...args) => {
      const { saleId, customerId } = args[0] as { saleId: number; customerId: number };
      return attachSaleToCustomer({ saleId, customerId });
    }),
  );

  ipcMain.handle(
    'sales:delete',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const saleId = args[0] as number;
      await deleteSale(saleId, session.userId);
      return true;
    }),
  );

  ipcMain.handle(
    'shifts:getCurrentSummary',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const branchId = (args[0] as number) || session.branchId || 1;
      return getCurrentShiftSummary(branchId);
    }),
  );

  ipcMain.handle(
    'shifts:close',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as ShiftCloseInput;
      const branchId = payload.branchId || session.branchId || 1;
      return closeShift({
        ...payload,
        branchId,
        cashierId: session.userId,
      });
    }),
  );

  ipcMain.handle(
    'shifts:list',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const branchId = args[0] as number | undefined;
      return listShiftClosings(branchId);
    }),
  );

  handlersRegistered = true;
}
