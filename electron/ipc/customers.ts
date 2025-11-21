import { ipcMain } from 'electron';
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  getCustomerHistory,
  attachSaleToCustomer,
} from '../db/database';
import type { CustomerInput, CustomerUpdateInput } from '../db/types';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerCustomerIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle(
    'customers:list',
    requireRole(['admin', 'manager', 'cashier'])(async () => listCustomers()),
  );

  ipcMain.handle(
    'customers:create',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const payload = args[0] as CustomerInput;
      return createCustomer(payload);
    }),
  );

  ipcMain.handle(
    'customers:update',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const payload = args[0] as CustomerUpdateInput;
      return updateCustomer(payload);
    }),
  );

  ipcMain.handle(
    'customers:history',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const customerId = args[0] as number;
      return getCustomerHistory(customerId);
    }),
  );

  ipcMain.handle(
    'customers:attach-sale',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, _session, ...args) => {
      const payload = args[0] as { saleId: number; customerId: number };
      await attachSaleToCustomer(payload);
      return true;
    }),
  );

  handlersRegistered = true;
}

