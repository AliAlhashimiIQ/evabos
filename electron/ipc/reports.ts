import { ipcMain } from 'electron';
import { getAdvancedReports } from '../db/database';
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

  handlersRegistered = true;
}

