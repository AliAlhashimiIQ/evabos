import { ipcMain } from 'electron';
import {
  login,
  logout,
  getSession,
  logActivity,
  getPosLockStatus,
  lockPos,
  unlockPos,
  listActivityLogs,
} from '../db/database';

let handlersRegistered = false;

export const requireRole =
  (roles: Array<'admin' | 'manager' | 'cashier'>) =>
  (handler: (event: Electron.IpcMainInvokeEvent, session: ReturnType<typeof getSession>, ...args: any[]) => any) =>
    async (_event: Electron.IpcMainInvokeEvent, sessionToken: string, ...args: any[]) => {
      const session = getSession(sessionToken);
      if (!session || !roles.includes(session.role)) {
        throw new Error('Unauthorized');
      }
      return handler(_event, session, ...args);
    };

export function registerAuthIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    return login(username, password);
  });

  ipcMain.handle('auth:logout', async (_event, token: string) => {
    await logout(token);
    return true;
  });

  ipcMain.handle('auth:getCurrentUser', async (_event, token: string) => {
    const session = getSession(token);
    if (!session) {
      return null;
    }
    return {
      userId: session.userId,
      username: session.username,
      role: session.role,
      branchId: session.branchId,
    };
  });

  ipcMain.handle('auth:getPosLockStatus', async () => {
    return getPosLockStatus();
  });

  ipcMain.handle('auth:lockPos', async (_event, token: string) => {
    const session = getSession(token);
    if (!session) {
      throw new Error('Unauthorized');
    }
    if (session.role !== 'admin' && session.role !== 'manager') {
      throw new Error('Only admin or manager can lock POS');
    }
    lockPos(session.userId);
    await logActivity(session.userId, 'pos_lock', 'system', null);
    return getPosLockStatus();
  });

  ipcMain.handle('auth:unlockPos', async (_event, token: string) => {
    const session = getSession(token);
    if (!session) {
      throw new Error('Unauthorized');
    }
    if (session.role !== 'admin' && session.role !== 'manager') {
      throw new Error('Only admin or manager can unlock POS');
    }
    unlockPos(session.userId);
    await logActivity(session.userId, 'pos_unlock', 'system', null);
    return getPosLockStatus();
  });

  ipcMain.handle('auth:getActivityLogs', async (_event, token: string, limit?: number) => {
    const session = getSession(token);
    if (!session) {
      throw new Error('Unauthorized');
    }
    if (session.role !== 'admin' && session.role !== 'manager') {
      throw new Error('Only admin or manager can view activity logs');
    }
    return listActivityLogs(limit);
  });

  handlersRegistered = true;
}

