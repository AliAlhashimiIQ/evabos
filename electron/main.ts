import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import * as path from 'path';
import { readFileSync } from 'fs';
import {
  initDatabase,
  getSetting,
  setSetting,
  getAllSettings,
  closeDatabase,
} from './db/database';
import { registerInventoryIpc } from './ipc/inventory';
import { registerPurchasingIpc } from './ipc/purchasing';
import { registerCustomerIpc } from './ipc/customers';
import { registerReturnsIpc } from './ipc/returns';
import { registerExpensesIpc } from './ipc/expenses';
import { registerReportsIpc } from './ipc/reports';
import { registerPrintingIpc } from './ipc/printing';
import { registerAuthIpc } from './ipc/auth';
import { registerBackupIpc } from './ipc/backup';
import { registerSalesIpc } from './ipc/sales';
import { registerExchangeRatesIpc } from './ipc/exchangeRates';
import { registerUsersIpc } from './ipc/users';
import { registerBranchesIpc } from './ipc/branches';
import { registerDashboardIpc } from './ipc/dashboard';
import { registerLicensingIpc } from './ipc/licensing';
import { registerSettingsIpc } from './ipc/settings';
import { registerEmailIpc } from './ipc/email';
import { createBackup } from './db/backup';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5174';

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
  });
  autoUpdater.on('update-available', (info) => {
    log.info('Update available.', info);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', info);
    }
  });
  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available.', info);
  });
  autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater. ' + err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', err.message);
    }
  });
  autoUpdater.on('download-progress', (progressObj) => {
    log.info(`Download progress: ${progressObj.percent}%`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-progress', progressObj);
    }
  });
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', info);
      // Ask user to restart? Or auto restart?
      // For now just notify.
    }
  });
}

let mainWindow: BrowserWindow | null = null;
let ipcRegistered = false;

async function loadWindowContent(targetWindow: BrowserWindow): Promise<void> {
  if (isDev) {
    // Dev: Use Vite dev server
    await targetWindow.loadURL(DEV_SERVER_URL);
    return;
  }

  // Prod: Use custom app:// protocol for ES modules support
  const indexPath = path.join(__dirname, '../renderer/dist/index.html');
  const relativePath = path.relative(app.getAppPath(), indexPath).replace(/\\/g, '/');
  const appUrl = `app://${relativePath}`;
  await targetWindow.loadURL(appUrl);
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true, // Hide menu bar (File, Edit, View, etc.)
    icon: path.join(__dirname, '../build/icon.png'), // App icon
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Required for ES modules with file:// protocol
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Intercept navigation to ensure it stays within app:// protocol
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isDev && mainWindow) {
      const parsedUrl = new URL(navigationUrl);

      // Only allow app:// protocol in production
      if (parsedUrl.protocol !== 'app:') {
        event.preventDefault();
        // If it's trying to reload, reload using the current app:// URL
        const currentUrl = mainWindow.webContents.getURL();
        if (currentUrl && currentUrl.startsWith('app://')) {
          mainWindow.webContents.loadURL(currentUrl);
        }
      }
    }
  });

  await loadWindowContent(mainWindow);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Fix Chromium focus desync bug on Windows
  // When the window regains focus, ensure webContents also has focus
  mainWindow.on('focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.focus();
    }
  });

  // Also fix focus when the app becomes active
  mainWindow.on('show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const registerIpcHandlers = (): void => {
  if (ipcRegistered) {
    return;
  }

  ipcMain.handle('db:get-setting', async (_event, key: string) => {
    return getSetting(key);
  });

  ipcMain.handle('db:set-setting', async (_event, key: string, value: string) => {
    await setSetting(key, value);
    return true;
  });

  ipcMain.handle('db:get-all-settings', async () => {
    return getAllSettings();
  });

  ipcMain.handle('app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle('app:reset-focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.blur();
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.focus();
        }
      }, 100);
    }
  });

  ipcRegistered = true;
};

// Daily backup scheduler
let dailyBackupTimeout: NodeJS.Timeout | null = null;
let dailyBackupInterval: NodeJS.Timeout | null = null;

const performBackup = async (): Promise<void> => {
  log.info('[backup] Starting scheduled backup...');

  try {
    const startTime = Date.now();
    await createBackup();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    log.info(`[backup] Completed successfully in ${duration}s`);

    // Notify renderer (optional - show toast notification)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backup:completed', {
        success: true,
        duration
      });
    }
  } catch (err) {
    log.error('[backup] Failed:', err);

    // Notify renderer of failure
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backup:completed', {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }
};

const scheduleDailyBackup = (): void => {
  // Clear any existing timers
  if (dailyBackupTimeout) clearTimeout(dailyBackupTimeout);
  if (dailyBackupInterval) clearInterval(dailyBackupInterval);

  log.info('[backup] Scheduling daily backup (deferred 10s to avoid blocking startup)...');

  // Defer first backup by 10 seconds (app fully loaded)
  dailyBackupTimeout = setTimeout(async () => {
    await performBackup();

    // Schedule subsequent backups every 24 hours
    dailyBackupInterval = setInterval(performBackup, 24 * 60 * 60 * 1000);
  }, 10000); // 10 seconds delay
};

// Daily email report scheduler
let dailyEmailTimeout: NodeJS.Timeout | null = null;
let dailyEmailInterval: NodeJS.Timeout | null = null;

const scheduleDailyEmailReport = async (): Promise<void> => {
  if (dailyEmailTimeout) clearTimeout(dailyEmailTimeout);
  if (dailyEmailInterval) clearInterval(dailyEmailInterval);

  log.info('[email] Scheduling daily email reports...');

  // Get send time from settings (default 20:00)
  let sendTime = '20:00';
  try {
    const { getEmailSettings } = await import('./db/emailReports');
    const settings = await getEmailSettings();
    sendTime = settings.sendTime || '20:00';
  } catch (err) {
    log.warn('[email] Could not load settings, using default 20:00');
  }

  // Parse hour and minute from sendTime (format "HH:MM")
  const [hours, minutes] = sendTime.split(':').map(Number);
  const targetHour = hours || 20;
  const targetMinute = minutes || 0;

  // Calculate time until target time today or tomorrow
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMinute, 0, 0);

  // If it's past the target time, schedule for tomorrow
  if (now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const msUntilTarget = target.getTime() - now.getTime();
  log.info(`[email] Next email report scheduled for ${target.toLocaleString()} (${sendTime})`);

  dailyEmailTimeout = setTimeout(async () => {
    try {
      const { sendDailyReport } = await import('./db/emailReports');
      const result = await sendDailyReport();
      log.info('[email] Daily report result:', result);
    } catch (err) {
      log.error('[email] Failed to send daily report:', err);
    }

    // Schedule subsequent emails every 24 hours
    dailyEmailInterval = setInterval(async () => {
      try {
        const { sendDailyReport } = await import('./db/emailReports');
        const result = await sendDailyReport();
        log.info('[email] Daily report result:', result);
      } catch (err) {
        log.error('[email] Failed to send daily report:', err);
      }
    }, 24 * 60 * 60 * 1000);
  }, msUntilTarget);
};

// Register custom protocol for production to handle ES modules
if (!isDev) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        secure: true,
        standard: true,
        corsEnabled: true,
        supportFetchAPI: true,
        stream: true,
      },
    },
  ]);
}

app.whenReady().then(async () => {
  // Register custom protocol handler for production
  if (!isDev) {
    protocol.registerBufferProtocol('app', (request, callback) => {
      const url = request.url.replace('app://', '');
      const filePath = path.join(app.getAppPath(), url);

      try {
        const data = readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'text/plain';

        if (ext === '.html') mimeType = 'text/html';
        else if (ext === '.js') mimeType = 'application/javascript';
        else if (ext === '.css') mimeType = 'text/css';
        else if (ext === '.json') mimeType = 'application/json';
        else if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.svg') mimeType = 'image/svg+xml';

        callback({ mimeType, data });
      } catch (error) {
        log.error('[protocol] Failed to load:', filePath, error);
        callback({ error: -6 }); // FILE_NOT_FOUND
      }
    });
  }
  await initDatabase();
  registerIpcHandlers();
  registerAuthIpc();
  registerInventoryIpc();
  registerPurchasingIpc();
  registerCustomerIpc();
  registerReturnsIpc();
  registerExpensesIpc();
  registerSalesIpc();
  registerExchangeRatesIpc();
  registerReportsIpc();
  registerPrintingIpc();
  registerBackupIpc();
  registerUsersIpc();
  registerBranchesIpc();
  registerDashboardIpc();
  registerLicensingIpc();
  registerSettingsIpc();
  registerEmailIpc();
  scheduleDailyBackup();
  scheduleDailyEmailReport();
  await createWindow();

  if (!isDev) {
    setupAutoUpdater();
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (dailyBackupTimeout) {
    clearTimeout(dailyBackupTimeout);
    dailyBackupTimeout = null;
  }
  if (dailyBackupInterval) {
    clearInterval(dailyBackupInterval);
    dailyBackupInterval = null;
  }
  await closeDatabase();
});
