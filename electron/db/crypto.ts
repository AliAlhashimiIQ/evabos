/**
 * Credential encryption utilities for SMTP password storage
 * Uses AES-256-GCM with machine-specific key derivation
 */

import crypto from 'crypto';
import os from 'os';
import log from 'electron-log';

// Key derivation parameters
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = 'eva-pos-smtp-v1'; // Fixed salt for consistency

/**
 * Generate a machine-specific encryption key
 * This key is derived from hardware characteristics so credentials
 * encrypted on one machine cannot be decrypted on another
 */
function getMachineKey(): Buffer {
    const components = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.cpus()[0]?.model || '',
        os.totalmem().toString(),
        SALT,
    ].join('|');

    // Use scrypt for key derivation (slow by design to resist brute force)
    return crypto.scryptSync(components, SALT, KEY_LENGTH);
}

/**
 * Encrypt a credential value
 * @param plaintext The plaintext credential to encrypt
 * @returns Base64-encoded encrypted string in format: iv:authTag:ciphertext
 */
export function encryptCredential(plaintext: string): string {
    if (!plaintext) return '';

    try {
        const key = getMachineKey();
        const iv = crypto.randomBytes(IV_LENGTH);

        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const authTag = cipher.getAuthTag();

        // Format: iv:authTag:ciphertext (all base64)
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (err) {
        log.error('[crypto] Encryption failed:', err);
        throw new Error('Failed to encrypt credential');
    }
}

/**
 * Decrypt a credential value
 * @param encrypted The encrypted string in format: iv:authTag:ciphertext
 * @returns The decrypted plaintext credential
 */
export function decryptCredential(encrypted: string): string {
    if (!encrypted) return '';

    // Check if this looks like encrypted data (should have 2 colons)
    if (!encrypted.includes(':') || encrypted.split(':').length !== 3) {
        // This is likely plaintext from before encryption was implemented
        // Return as-is to allow gradual migration
        return encrypted;
    }

    try {
        const [ivBase64, authTagBase64, ciphertext] = encrypted.split(':');

        const key = getMachineKey();
        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (err) {
        log.error('[crypto] Decryption failed - returning empty:', err);
        // If decryption fails, return empty to force re-entry
        // This can happen if credentials were encrypted on a different machine
        return '';
    }
}

/**
 * Check if a value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
    if (!value) return false;
    const parts = value.split(':');
    return parts.length === 3 && parts.every(p => p.length > 0);
}
