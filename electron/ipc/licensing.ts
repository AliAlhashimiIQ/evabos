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

// Validate license
async function validateLicense(): Promise<{ valid: boolean; reason?: string; isUsb?: boolean }> {
  try {
    const storedLicense = await getSetting('app_license_key');
    const storedMachineId = await getSetting('app_machine_id');
    const currentMachineId = getMachineFingerprint();
    const usbSerial = await getUsbSerialNumber();
    
    // Check if running from USB
    const isUsb = usbSerial !== null || app.getAppPath().toLowerCase().includes('removable');
    
    if (!storedLicense) {
      // First run - generate and store license
      const licenseKey = await generateLicenseKey(usbSerial || undefined);
      await setSetting('app_license_key', licenseKey);
      await setSetting('app_machine_id', currentMachineId);
      await setSetting('app_usb_serial', usbSerial || '');
      return { valid: true, isUsb };
    }
    
    // Validate stored license matches current machine/USB
    const expectedLicense = await generateLicenseKey(
      storedMachineId === currentMachineId ? usbSerial || undefined : undefined
    );
    
    if (storedLicense === expectedLicense) {
      // Update machine ID if changed (but license still valid)
      if (storedMachineId !== currentMachineId) {
        await setSetting('app_machine_id', currentMachineId);
      }
      return { valid: true, isUsb };
    }
    
    // License mismatch - check if it's a different machine
    if (storedMachineId && storedMachineId !== currentMachineId) {
      return { valid: false, reason: 'Application has been moved to a different computer' };
    }
    
    // USB serial changed
    if (isUsb && usbSerial) {
      const storedUsbSerial = await getSetting('app_usb_serial');
      if (storedUsbSerial && storedUsbSerial !== usbSerial) {
        return { valid: false, reason: 'Application has been moved to a different USB drive' };
      }
    }
    
    return { valid: false, reason: 'License validation failed' };
  } catch (err) {
    console.error('License validation error:', err);
    return { valid: false, reason: 'License validation error' };
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

