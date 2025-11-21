import { ipcMain } from 'electron';
import { listReturns, createReturn, getSaleForReturn } from '../db/database';
import type { ReturnInput } from '../db/types';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerReturnsIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle(
    'returns:list',
    requireRole(['admin', 'manager', 'cashier'])(async () => {
      return listReturns();
    }),
  );

  ipcMain.handle(
    'returns:create',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as ReturnInput;
      const result = await createReturn({
        ...payload,
        processedBy: session.userId,
      });
      return result;
    }),
  );

  ipcMain.handle(
    'returns:sale-info',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, _session, ...args) => {
      const saleId = args[0] as number;
      return getSaleForReturn(saleId);
    }),
  );

  handlersRegistered = true;
}

