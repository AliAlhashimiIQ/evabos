import { ipcMain } from 'electron';
import {
  listPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
} from '../db/database';
import type {
  PurchaseOrderInput,
  PurchaseOrderReceiveInput,
} from '../db/types';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerPurchasingIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle(
    'purchasing:purchase-orders:list',
    requireRole(['admin', 'manager'])(async () => {
      return listPurchaseOrders();
    }),
  );

  ipcMain.handle(
    'purchasing:purchase-orders:create',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const payload = args[0] as PurchaseOrderInput;
      return createPurchaseOrder(payload);
    }),
  );

  ipcMain.handle(
    'purchasing:purchase-orders:receive',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const payload = args[0] as PurchaseOrderReceiveInput;
      return receivePurchaseOrder(payload);
    }),
  );

  handlersRegistered = true;
}

