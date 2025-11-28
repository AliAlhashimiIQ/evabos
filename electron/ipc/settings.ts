import { ipcMain } from 'electron';
import { resetDatabase } from '../db/database';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerSettingsIpc(): void {
    if (handlersRegistered) {
        return;
    }

    ipcMain.handle(
        'settings:reset',
        requireRole(['admin'])(async (_event, session) => {
            if (!session) throw new Error('Unauthorized');
            await resetDatabase();
            await (await import('../db/database')).logActivity(session.userId, 'reset', 'system', 0);
            return true;
        }),
    );

    handlersRegistered = true;
}
