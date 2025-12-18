import { ipcMain, app } from 'electron';
import * as os from 'os';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import log from 'electron-log';
import { getSetting, setSetting } from '../db/database';

let handlersRegistered = false;

// ============================================================================
// LICENSE SECRET - Obfuscated to prevent easy extraction from decompiled code
// The actual secret is derived at runtime from these components.
// For the license generator tool, see tools/generate-license.js
// ============================================================================
const _k1 = 'vxH/OXFe';
const _k2 = '6jiiB5/q';
const _k3 = 'umKTE8u8';
const _k4 = '4m+OiuOy';
const getLicenseSecret = (): string => [_k1, _k2, _k3, _k4].join('');

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

// License key format: EVA-XXXX-XXXX-XXXX-XXXX
// Encrypted payload: machineId|expiryDate|features
interface LicensePayload {
  machineId: string;
  expiryDate: string; // ISO date or 'lifetime'
  features: string[];
  activatedAt: string;
}

type DecodeResult = {
  success: boolean;
  payload?: LicensePayload;
  error?: string;
};

/**
 * Validates format and decrypts key
 */
function decodeLicenseKey(licenseKey: string): DecodeResult {
  try {
    // Remove EVA- prefix and keep only hex characters
    const cleanKey = licenseKey.replace(/^EVA-/i, '').replace(/[^a-fA-F0-9]/g, '');

    if (cleanKey.length < 32) { // Minimum 16 bytes IV + at least some ciphertext
      return { success: false, error: 'Invalid format (length)' };
    }

    // Derive key from secret
    const key = crypto.scryptSync(getLicenseSecret(), 'salt', 32);

    // First 32 hex chars are 16-byte IV
    const iv = Buffer.from(cleanKey.substring(0, 32), 'hex');
    const ciphertext = Buffer.from(cleanKey.substring(32), 'hex');

    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    const payloadString = decrypted.toString('utf8');
    const payload = JSON.parse(payloadString) as LicensePayload;

    return { success: true, payload };
  } catch (err) {
    log.error('[LICENSE] Failed to decode license key:', err);
    return { success: false, error: 'Decryption failed (bad key)' };
  }
}

// ============================================================================
// SECURITY NOTE: License key generation has been REMOVED from client code.
// Use the separate tools/generate-license.js script (NOT shipped with app)
// to generate license keys for customers.
// ============================================================================

// Validate license
async function validateLicense(): Promise<{ valid: boolean; reason?: string; isUsb?: boolean; expiresAt?: string }> {
  try {
    const usbSerial = await getUsbSerialNumber();
    const isUsb = usbSerial !== null || app.getAppPath().toLowerCase().includes('removable');

    // Get stored license key
    const storedLicense = await getSetting('license_key');

    if (!storedLicense) {
      return { valid: false, reason: 'No license key found', isUsb };
    }

    // Decode and validate
    const decodeResult = decodeLicenseKey(storedLicense);

    if (!decodeResult.success || !decodeResult.payload) {
      // If decoding failed, it's invalid
      return { valid: false, reason: decodeResult.error || 'Invalid license key format', isUsb };
    }

    const payload = decodeResult.payload;

    // Check machine ID matches
    const currentMachineId = getMachineFingerprint();
    if (payload.machineId !== currentMachineId && payload.machineId !== '*') {
      log.warn('[LICENSE] Machine ID mismatch:', payload.machineId, 'vs', currentMachineId);
      return { valid: false, reason: 'License not valid for this machine', isUsb };
    }

    // Check expiry
    if (payload.expiryDate !== 'lifetime') {
      const expiry = new Date(payload.expiryDate);
      if (isNaN(expiry.getTime()) || expiry < new Date()) {
        return { valid: false, reason: 'License has expired', isUsb, expiresAt: payload.expiryDate };
      }
      return { valid: true, isUsb, expiresAt: payload.expiryDate };
    }

    return { valid: true, isUsb };
  } catch (err) {
    log.error('[LICENSE] Validation error:', err);
    return { valid: false, reason: 'License validation failed' };
  }
}

/**
 * Activate a license key
 */
async function activateLicense(licenseKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate format (EVA- followed by segments of 4 chars)
    if (!licenseKey.toUpperCase().startsWith('EVA-')) {
      return { success: false, error: 'Invalid license key format (Missing EVA- prefix)' };
    }

    // Decode and validate
    const decodeResult = decodeLicenseKey(licenseKey);

    if (!decodeResult.success || !decodeResult.payload) {
      return { success: false, error: decodeResult.error || 'Invalid license key' };
    }

    const payload = decodeResult.payload;

    // Check machine ID (unless it's a wildcard)
    const currentMachineId = getMachineFingerprint();
    if (payload.machineId !== currentMachineId && payload.machineId !== '*') {
      return { success: false, error: 'License key not valid for this machine' };
    }

    // Check expiry
    if (payload.expiryDate !== 'lifetime') {
      const expiry = new Date(payload.expiryDate);
      if (isNaN(expiry.getTime()) || expiry < new Date()) {
        return { success: false, error: 'License key has expired' };
      }
    }

    // Store the license
    await setSetting('license_key', licenseKey);
    await setSetting('license_activated_at', new Date().toISOString());

    log.info('[LICENSE] License activated successfully');
    return { success: true };
  } catch (err) {
    log.error('[LICENSE] Activation error:', err);
    return { success: false, error: 'Failed to activate license' };
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

  ipcMain.handle('licensing:activate', async (_event, licenseKey: string) => {
    return activateLicense(licenseKey);
  });

  handlersRegistered = true;
}


