import { app, BrowserWindow, ipcMain, protocol } from 'electron';
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
import { createBackup } from './db/backup';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5174';

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

  ipcRegistered = true;
};

// Daily backup scheduler
let dailyBackupInterval: NodeJS.Timeout | null = null;

const scheduleDailyBackup = (): void => {
  if (dailyBackupInterval) {
    clearInterval(dailyBackupInterval);
  }

  const runBackup = async () => {
    try {
      await createBackup();
      console.log('[backup] Daily backup completed successfully');
    } catch (err) {
      console.error('[backup] Daily backup failed:', err);
    }
  };

  runBackup();
  dailyBackupInterval = setInterval(runBackup, 24 * 60 * 60 * 1000);
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
        console.error('[protocol] Failed to load:', filePath, error);
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
  scheduleDailyBackup();
  await createWindow();

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
  if (dailyBackupInterval) {
    clearInterval(dailyBackupInterval);
    dailyBackupInterval = null;
  }
  await closeDatabase();
});
