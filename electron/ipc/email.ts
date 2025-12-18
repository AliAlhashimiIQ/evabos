import { ipcMain } from 'electron';
import { setSetting } from '../db/database';
import { sendDailyReport, getEmailSettings } from '../db/emailReports';
import { encryptCredential } from '../db/crypto';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerEmailIpc(): void {
    if (handlersRegistered) {
        return;
    }

    // Get email settings
    ipcMain.handle(
        'email:getSettings',
        requireRole(['admin', 'manager'])(async () => {
            const settings = await getEmailSettings();
            // Don't return the decrypted password to frontend - return masked
            return {
                ...settings,
                smtpPassword: settings.smtpPassword ? '••••••••' : '',
            };
        }),
    );

    // Save email settings
    ipcMain.handle(
        'email:saveSettings',
        requireRole(['admin'])(async (_event, _session, ...args) => {
            const settings = args[0] as {
                smtpHost: string;
                smtpPort: number;
                smtpSecure: boolean;
                smtpUser: string;
                smtpPassword: string;
                emailRecipient: string;
                emailEnabled: boolean;
                sendTime?: string;
            };

            await setSetting('email_smtp_host', settings.smtpHost);
            await setSetting('email_smtp_port', String(settings.smtpPort));
            await setSetting('email_smtp_secure', settings.smtpSecure ? 'true' : 'false');
            await setSetting('email_smtp_user', settings.smtpUser);

            // Only update password if user entered a new one (not the masked value)
            if (settings.smtpPassword && settings.smtpPassword !== '••••••••') {
                const encryptedPassword = encryptCredential(settings.smtpPassword);
                await setSetting('email_smtp_password', encryptedPassword);
            }

            await setSetting('email_recipient', settings.emailRecipient);
            await setSetting('email_enabled', settings.emailEnabled ? 'true' : 'false');
            if (settings.sendTime) {
                await setSetting('email_send_time', settings.sendTime);
            }

            return true;
        }),
    );

    // Send test email - returns { success: boolean, error?: string }
    ipcMain.handle(
        'email:sendTest',
        requireRole(['admin'])(async () => {
            return sendDailyReport();
        }),
    );

    handlersRegistered = true;
}
