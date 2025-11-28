import { ipcMain, app } from 'electron';
import * as os from 'os';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { getSetting, setSetting } from '../db/database';

let handlersRegistered = false;

// Get machine fingerprint (hardware ID)
function getMachineFingerprint(): string {
  const components = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || '',
    os.totalmem().toString(),
  ].join('|');

  return crypto.createHash('sha256').update(components).digest('hex').substring(0, 16);
}

// Get USB drive serial number (if running from USB)
async function getUsbSerialNumber(): Promise<string | null> {
  try {
    const appPath = app.getAppPath();
    // Check if app is running from a removable drive
    if (process.platform === 'win32') {
      const drive = appPath.substring(0, 2); // e.g., "E:"
      // Try to get volume serial number
      try {
        const result = execSync(`vol ${drive}`, { encoding: 'utf-8' });
        const match = result.match(/Volume Serial Number is ([A-F0-9-]+)/i);
        if (match) {
          return match[1];
        }
      } catch {
        // If vol command fails, try alternative method using wmic
        try {
          const wmicResult = execSync(
            `wmic logicaldisk where "DeviceID='${drive}'" get VolumeSerialNumber`,
            { encoding: 'utf-8' }
          );
          const serialMatch = wmicResult.match(/VolumeSerialNumber\s+([A-F0-9]+)/i);
          if (serialMatch) {
            return serialMatch[1];
          }
        } catch {
          // Both methods failed
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Generate license key based on machine/USB
async function generateLicenseKey(usbSerial?: string): Promise<string> {
  const machineId = getMachineFingerprint();
  const base = usbSerial ? `${machineId}-${usbSerial}` : machineId;
  return crypto.createHash('sha256').update(base).digest('hex').substring(0, 32).toUpperCase();
}

// Validate license - PORTABLE MODE (Unlocked)
async function validateLicense(): Promise<{ valid: boolean; reason?: string; isUsb?: boolean }> {
  try {
    const usbSerial = await getUsbSerialNumber();
    const isUsb = usbSerial !== null || app.getAppPath().toLowerCase().includes('removable');

    // Always return valid for portable mode
    // We still detect if it's USB for information purposes, but we don't block.
    return { valid: true, isUsb };
  } catch (err) {
    console.error('[LICENSE] Validation error:', err);
    // Even on error, allow access in portable mode
    return { valid: true, reason: 'Portable mode active' };
  }
}

export function registerLicensingIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle('licensing:validate', async () => {
    return validateLicense();
  });

  ipcMain.handle('licensing:getMachineId', async () => {
    return getMachineFingerprint();
  });

  ipcMain.handle('licensing:getUsbInfo', async () => {
    const serial = await getUsbSerialNumber();
    const isUsb = serial !== null || app.getAppPath().toLowerCase().includes('removable');
    return { isUsb, serial };
  });

  handlersRegistered = true;
}

