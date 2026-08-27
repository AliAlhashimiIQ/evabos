import { ipcMain } from 'electron';
import {
  getTelegramSettings,
  saveTelegramSettings,
  sendTelegramTest,
  sendTelegramDailyReportAndBackup,
  startTelegramBotPolling,
  stopTelegramBotPolling,
} from '../db/telegram';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerTelegramIpc(): void {
  if (handlersRegistered) {
    return;
  }

  // Get Telegram settings (token masked)
  ipcMain.handle(
    'telegram:getSettings',
    requireRole(['admin', 'manager'])(async () => {
      const settings = await getTelegramSettings();
      return {
        ...settings,
        botToken: settings.botToken ? '••••••••' : '',
      };
    }),
  );

  // Save Telegram settings
  ipcMain.handle(
    'telegram:saveSettings',
    requireRole(['admin'])(async (_event, _session, ...args) => {
      const settings = args[0] as {
        botToken: string;
        chatId: string;
        enabled: boolean;
        notifyOnSale: boolean;
        notifyOnClose: boolean;
      };

      const result = await saveTelegramSettings(settings);
      stopTelegramBotPolling();
      if (settings.enabled) {
        startTelegramBotPolling();
      }
      return result;
    }),
  );

  // Send test message
  ipcMain.handle(
    'telegram:sendTest',
    requireRole(['admin'])(async () => {
      return sendTelegramTest();
    }),
  );

  // Trigger daily report & backup now manually
  ipcMain.handle(
    'telegram:sendDailyReportNow',
    requireRole(['admin', 'manager'])(async () => {
      return sendTelegramDailyReportAndBackup();
    }),
  );

  handlersRegistered = true;
}
