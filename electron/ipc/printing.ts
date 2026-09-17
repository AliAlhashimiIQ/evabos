import { BrowserWindow, ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { getSetting } from '../db/core';

let handlersRegistered = false;

// Production vs development logging
const isDev = process.env.NODE_ENV === 'development';
const log = (...args: any[]) => {
  if (isDev) console.log(...args);
};
const logError = (...args: any[]) => {
  console.error(...args); // Always log errors
};

const KICK_DRAWER_PS1_CONTENT = `param(
    [string]$PrinterName = ""
)

if ([string]::IsNullOrWhiteSpace($PrinterName)) {
    $defaultPrinter = Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1
    if ($defaultPrinter) {
        $PrinterName = $defaultPrinter.Name
    }
}

if ([string]::IsNullOrWhiteSpace($PrinterName)) {
    Write-Error "No printer specified and no default printer found."
    exit 1
}

$typeDefinition = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes)
    {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        bool bSuccess = false;

        di.pDocName = "CashDrawerPulse";
        di.pDataType = "RAW";

        if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero))
        {
            if (StartDocPrinter(hPrinter, 1, di))
            {
                if (StartPagePrinter(hPrinter))
                {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
                    Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);

                    int dwWritten = 0;
                    bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return bSuccess;
    }
}
"@

try {
    if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelper').Type) {
        Add-Type -TypeDefinition $typeDefinition
    }
} catch {
}

# Standard ESC/POS pulse: ESC p 0 25 250 (pin 2) - single clean kick pulse
$pulseBytes = [byte[]]@(0x1B, 0x70, 0x00, 0x19, 0xFA)

$result = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $pulseBytes)
if ($result) {
    Write-Output "SUCCESS: Drawer kick pulse sent to '$PrinterName'"
    exit 0
} else {
    Write-Error "FAILED: Could not send raw pulse to '$PrinterName'"
    exit 1
}
`;

let lastKickTimestamp = 0;
const KICK_DEBOUNCE_MS = 1200;

const kickCashDrawer = async (targetPrinterName?: string | null): Promise<boolean> => {
  const now = Date.now();
  if (now - lastKickTimestamp < KICK_DEBOUNCE_MS) {
    log('[Drawer] Kick skipped due to debounce window (' + (now - lastKickTimestamp) + 'ms)');
    return true;
  }
  lastKickTimestamp = now;

  return new Promise(async (resolve, reject) => {
    try {
      let printer = targetPrinterName?.trim();
      if (!printer) {
        const savedPrinter = await getSetting('receipt_printer_name');
        if (savedPrinter && savedPrinter.trim()) {
          printer = savedPrinter.trim();
        }
      }

      const tempScriptPath = path.join(app.getPath('temp'), 'eva-kick-drawer.ps1');
      await fs.promises.writeFile(tempScriptPath, KICK_DRAWER_PS1_CONTENT, 'utf8');

      const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tempScriptPath];
      if (printer) {
        args.push('-PrinterName', printer);
      }

      log('[Drawer] Executing drawer kick script for printer:', printer || 'System Default');

      execFile('powershell.exe', args, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          logError('[Drawer] Kick failed:', error, stderr);
          return resolve(false); // Resolve false rather than throwing so sales aren't aborted
        }
        log('[Drawer] Kick success:', stdout.trim());
        resolve(true);
      });
    } catch (err) {
      logError('[Drawer] Unexpected error in kickCashDrawer:', err);
      resolve(false);
    }
  });
};

const createPrintWindow = async (
  html: string,
  options?: { printerName?: string | null; silent?: boolean; isLabel?: boolean; pageSize?: any; copies?: number }
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
      backgroundThrottling: false, // Prevent Chromium from throttling rendering in hidden print window
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
  await new Promise(resolve => setTimeout(resolve, 600));

  // Now safe to print
  return new Promise<void>((resolve, reject) => {
    const hasPrinter = !!(options?.printerName && options.printerName.trim() !== '');

    const printOptions: Electron.WebContentsPrintOptions = {
      silent: options?.silent ?? (hasPrinter ? true : false),
      printBackground: true,
      landscape: false,
      margins: { marginType: 'none' },
      copies: Math.max(1, options?.copies ?? 1),
    };

    if (options?.pageSize) {
      printOptions.pageSize = options.pageSize;
    } else if (options?.isLabel) {
      // 50mm x 25mm barcode label standard in microns
      printOptions.pageSize = { width: 50000, height: 25000 };
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
            setTimeout(() => {
              if (!win.isDestroyed()) win.close();
            }, 500);
            resolve();
          } else {
            logError('[Print] Failed:', failureReason);
            setTimeout(() => {
              if (!win.isDestroyed()) win.close();
            }, 500);
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
        if (!win.isDestroyed()) win.close();
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
    async (_event, payload: { html: string; printerName?: string | null; silent?: boolean; isLabel?: boolean; pageSize?: any; copies?: number }) => {
      log('[Print] IPC received, printer:', payload.printerName || 'System Default', 'silent:', payload.silent, 'isLabel:', payload.isLabel, 'copies:', payload.copies);

      try {
        await createPrintWindow(payload.html, {
          printerName: payload.printerName,
          silent: payload.silent,
          isLabel: payload.isLabel,
          pageSize: payload.pageSize,
          copies: payload.copies,
        });
        return true;
      } catch (error) {
        logError('[Print] Error:', error);
        throw error;
      }
    },
  );

  ipcMain.handle('printing:kick-drawer', async (_event, printerName?: string | null) => {
    log('[Print] IPC kick drawer requested for printer:', printerName || 'Default');
    return kickCashDrawer(printerName);
  });

  handlersRegistered = true;
  log('[Print] IPC handlers registered');
}

