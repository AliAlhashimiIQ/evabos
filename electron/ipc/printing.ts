import { BrowserWindow, ipcMain } from 'electron';

let handlersRegistered = false;

// Production vs development logging
const isDev = process.env.NODE_ENV === 'development';
const log = (...args: any[]) => {
  if (isDev) console.log(...args);
};
const logError = (...args: any[]) => {
  console.error(...args); // Always log errors
};

const createPrintWindow = async (
  html: string,
  options?: { printerName?: string | null; silent?: boolean; isLabel?: boolean; pageSize?: any }
) => {
  log('[Print] Starting print job');

  // Create window
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      offscreen: false, // Must be false for print dialogs
    },
  });

  // CRITICAL: Attach listener BEFORE calling loadURL to prevent race condition
  const pageLoaded = new Promise<void>((resolve, reject) => {
    win.webContents.once('did-finish-load', () => {
      log('[Print] Page loaded successfully');
      resolve();
    });

    win.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
      logError('[Print] Page failed to load:', errorCode, errorDescription);
      reject(new Error(`Page failed to load: ${errorDescription}`));
    });
  });

  // Load the HTML (listener already attached)
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Wait for page to load
  await pageLoaded;

  // Give DOM time to render
  await new Promise(resolve => setTimeout(resolve, 500));

  // Now safe to print
  return new Promise<void>((resolve, reject) => {
    const hasPrinter = !!(options?.printerName && options.printerName.trim() !== '');

    const printOptions: Electron.WebContentsPrintOptions = {
      silent: options?.silent ?? (hasPrinter ? true : false),
      printBackground: true,
      landscape: false,
      margins: { marginType: 'none' },
    };

    if (options?.pageSize) {
      printOptions.pageSize = options.pageSize;
    } else if (options?.isLabel) {
      // Barcode stickers use native label driver sizing
    } else {
      // Standard thermal receipt roll paper (72mm width continuous roll)
      printOptions.pageSize = { width: 72000, height: 2000000 };
    }

    if (hasPrinter) {
      printOptions.deviceName = options.printerName!;
      log('[Print] Targeting printer deviceName:', printOptions.deviceName, 'silent:', printOptions.silent);
    }

    // Handle window close
    let printCompleted = false;
    win.on('closed', () => {
      if (!printCompleted) {
        logError('[Print] Window closed before completion');
        reject(new Error('Print window closed unexpectedly'));
      }
    });

    // Call print with callback
    win.webContents.print(
      printOptions,
      (success, failureReason) => {
        printCompleted = true;

        if (!success) {
          // Don't treat user cancellation as an error
          if (failureReason && failureReason.toLowerCase().includes('cancel')) {
            log('[Print] User cancelled');
            setTimeout(() => win.close(), 500);
            resolve();
          } else {
            logError('[Print] Failed:', failureReason);
            setTimeout(() => win.close(), 500);
            reject(new Error(failureReason || 'Print failed'));
          }
        } else {
          log('[Print] Success - waiting for spooler');
          // Add delay before closing window to prevent Windows print spooler from aborting
          setTimeout(() => {
            if (!win.isDestroyed()) {
              win.close();
            }
          }, 2000);
          resolve();
        }
      }
    );

    // Timeout as safety net (60 seconds for user interaction)
    setTimeout(() => {
      if (!printCompleted) {
        logError('[Print] Timeout after 60 seconds');
        win.close();
        reject(new Error('Print timeout - please try again'));
      }
    }, 60000); // 60 seconds
  });
};

export function registerPrintingIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle('printing:get-printers', async (event) => {
    const printers = await event.sender.getPrintersAsync();
    log('[Print] Available printers:', printers.length);
    return printers;
  });

  ipcMain.handle(
    'printing:print',
    async (_event, payload: { html: string; printerName?: string | null; silent?: boolean; isLabel?: boolean; pageSize?: any }) => {
      log('[Print] IPC received, printer:', payload.printerName || 'System Default', 'silent:', payload.silent, 'isLabel:', payload.isLabel);

      try {
        await createPrintWindow(payload.html, {
          printerName: payload.printerName,
          silent: payload.silent,
          isLabel: payload.isLabel,
          pageSize: payload.pageSize,
        });
        return true;
      } catch (error) {
        logError('[Print] Error:', error);
        throw error;
      }
    },
  );

  handlersRegistered = true;
  log('[Print] IPC handlers registered');
}
