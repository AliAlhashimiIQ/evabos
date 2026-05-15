import { ipcMain } from 'electron';
import {
  createOnlineOrder,
  listOnlineOrders,
  confirmOnlineOrder,
  rejectOnlineOrder,
  getOnlineOrderById,
} from '../db/database';
import type { OnlineOrderInput } from '../db/types';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerOnlineOrdersIpc(): void {
  if (handlersRegistered) return;

  ipcMain.handle(
    'onlineOrders:list',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, _session, ...args) => {
      const status = args[0] as string | undefined;
      return listOnlineOrders(status);
    }),
  );

  ipcMain.handle(
    'onlineOrders:create',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as OnlineOrderInput;
      return createOnlineOrder(payload, session.userId);
    }),
  );

  ipcMain.handle(
    'onlineOrders:confirm',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const orderId = args[0] as number;
      const exchangeRate = args[1] as number;
      return confirmOnlineOrder(orderId, session.userId, exchangeRate);
    }),
  );

  ipcMain.handle(
    'onlineOrders:reject',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const orderId = args[0] as number;
      const reason = args[1] as string | undefined;
      return rejectOnlineOrder(orderId, session.userId, reason);
    }),
  );

  ipcMain.handle(
    'onlineOrders:getById',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, _session, ...args) => {
      const orderId = args[0] as number;
      return getOnlineOrderById(orderId);
    }),
  );

  ipcMain.handle(
    'onlineOrders:update',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const orderId = args[0] as number;
      const payload = args[1] as OnlineOrderInput;
      // We will need to import updateOnlineOrder and deleteOnlineOrder from database.ts
      const { updateOnlineOrder } = await import('../db/database');
      return updateOnlineOrder(orderId, payload, session.userId);
    }),
  );

  ipcMain.handle(
    'onlineOrders:delete',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const orderId = args[0] as number;
      const { deleteOnlineOrder } = await import('../db/database');
      await deleteOnlineOrder(orderId, session.userId);
      return true;
    }),
  );

  handlersRegistered = true;
}
