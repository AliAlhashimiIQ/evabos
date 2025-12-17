import { ipcMain } from 'electron';
import { getAdvancedReports, getPeakHoursData, getPeakDaysData, getLeastProfitableItems, getLeastProfitableSuppliers, getInventoryAging } from '../db/database';
import type { DateRange } from '../db/types';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerReportsIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle(
    'reports:advanced',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const range = args[0] as DateRange;
      return getAdvancedReports(range);
    }),
  );

  ipcMain.handle(
    'reports:peakHours',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const { startDate, endDate, branchId } = args[0] as { startDate: string; endDate: string; branchId?: number };
      return getPeakHoursData(startDate, endDate, branchId);
    }),
  );

  ipcMain.handle(
    'reports:peakDays',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const { startDate, endDate, branchId } = args[0] as { startDate: string; endDate: string; branchId?: number };
      return getPeakDaysData(startDate, endDate, branchId);
    }),
  );

  ipcMain.handle(
    'reports:leastProfitableItems',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const { startDate, endDate, exchangeRate, limit } = args[0] as { startDate: string; endDate: string; exchangeRate?: number; limit?: number };
      return getLeastProfitableItems(startDate, endDate, exchangeRate, limit);
    }),
  );

  ipcMain.handle(
    'reports:leastProfitableSuppliers',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const { startDate, endDate, exchangeRate } = args[0] as { startDate: string; endDate: string; exchangeRate?: number };
      return getLeastProfitableSuppliers(startDate, endDate, exchangeRate);
    }),
  );

  ipcMain.handle(
    'reports:inventoryAging',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const { limit } = args[0] as { limit?: number };
      return getInventoryAging(limit);
    }),
  );

  handlersRegistered = true;
}

