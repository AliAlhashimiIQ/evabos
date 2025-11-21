import { ipcMain } from 'electron';
import { getCurrentExchangeRate, updateExchangeRate } from '../db/database';
import type { ExchangeRateInput } from '../db/types';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerExchangeRatesIpc(): void {
  if (handlersRegistered) {
    return;
  }

  // Get current rate is public (no auth required)
  ipcMain.handle('exchangeRates:getCurrent', async () => {
    return getCurrentExchangeRate();
  });

  // Update requires admin or manager
  ipcMain.handle(
    'exchangeRates:update',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const payload = args[0] as ExchangeRateInput;
      return updateExchangeRate(payload);
    }),
  );

  handlersRegistered = true;
}

