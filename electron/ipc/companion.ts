import { ipcMain } from 'electron';
import { getCompanionServerInfo, lookupProductDetails } from '../server/companionServer';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerCompanionIpc(): void {
  if (handlersRegistered) {
    return;
  }

  // Get Companion connection info & QR Code
  ipcMain.handle('companion:getInfo', async () => {
    return getCompanionServerInfo();
  });

  // Direct Product Lookup for promotion/price checking
  ipcMain.handle('companion:lookup', async (_event, ...args) => {
    const query = typeof args[0] === 'string' ? args[0] : typeof args[1] === 'string' ? args[1] : '';
    return lookupProductDetails(query);
  });

  handlersRegistered = true;
}
