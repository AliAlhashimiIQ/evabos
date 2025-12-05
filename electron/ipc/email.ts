import { ipcMain } from 'electron';
import { setSetting } from '../db/database';
import { sendDailyReport, getEmailSettings } from '../db/emailReports';
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
            return getEmailSettings();
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
            await setSetting('email_smtp_password', settings.smtpPassword);
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
