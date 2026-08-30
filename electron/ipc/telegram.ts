import { ipcMain } from 'electron';
import {
  getTelegramSettings,
  saveTelegramSettings,
  sendTelegramTest,
  sendTelegramDailyReportAndBackup,
  startTelegramBotPolling,
  stopTelegramBotPolling,
  requestTelegramUnlockOtp,
  verifyTelegramUnlockOtp,
  isTelegramSettingsUnlocked,
  lockTelegramSettings,
  requestDiscountApproval,
  checkDiscountApprovalStatus,
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
        isConfigured: !!(settings.botToken && settings.chatId),
      };
    }),
  );

  // Request 2FA OTP sent to owner's Telegram chat
  ipcMain.handle(
    'telegram:requestUnlockOtp',
    requireRole(['admin', 'manager'])(async () => {
      return requestTelegramUnlockOtp();
    }),
  );

  // Verify 2FA OTP entered by user
  ipcMain.handle(
    'telegram:verifyUnlockOtp',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const code = String(args[0] || '');
      return verifyTelegramUnlockOtp(code);
    }),
  );

  // Check if settings are currently unlocked
  ipcMain.handle(
    'telegram:isUnlocked',
    requireRole(['admin', 'manager'])(async () => {
      const settings = await getTelegramSettings();
      // If never configured, it's open for initial setup
      if (!settings.botToken || !settings.chatId) {
        return true;
      }
      return isTelegramSettingsUnlocked();
    }),
  );

  // Lock settings again immediately
  ipcMain.handle(
    'telegram:lock',
    requireRole(['admin', 'manager'])(async () => {
      lockTelegramSettings();
      return true;
    }),
  );

  // Save Telegram settings (requires unlock if already configured)
  ipcMain.handle(
    'telegram:saveSettings',
    requireRole(['admin'])(async (_event, _session, ...args) => {
      const current = await getTelegramSettings();
      if (current.botToken && current.chatId && !isTelegramSettingsUnlocked()) {
        throw new Error('الإعدادات مقفلة. يرجى طلب رمز التحقق عبر تيليجرام لفك القفل أولاً');
      }

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

  // Remote Discount Approval Request (Any logged-in cashier can request approval)
  ipcMain.handle(
    'telegram:requestDiscountApproval',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, _session, ...args) => {
      const payload = args[0] as {
        subtotalIQD: number;
        discountIQD: number;
        cashierName: string;
        itemsSummary?: string;
      };
      return requestDiscountApproval(payload);
    }),
  );

  // Check Remote Discount Approval Status
  ipcMain.handle(
    'telegram:checkDiscountApproval',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, _session, ...args) => {
      const requestId = String(args[0] || '');
      return checkDiscountApprovalStatus(requestId);
    }),
  );

  handlersRegistered = true;
}
