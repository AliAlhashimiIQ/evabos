import { ipcMain } from 'electron';
import { getDashboardKPIs } from '../db/database';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerDashboardIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle(
    'dashboard:getKPIs',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, session, ...args) => {
      const branchId = args[0] as number | undefined;
      const dateRange = args[1] as { startDate: string; endDate: string } | undefined;
      const effectiveBranchId = branchId ?? (session?.branchId ?? undefined);
      return getDashboardKPIs(effectiveBranchId, dateRange);
    }),
  );

  handlersRegistered = true;
}

