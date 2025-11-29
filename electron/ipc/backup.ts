import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import { createBackup, listBackups, restoreBackup, deleteBackup, getBackupDirPath } from '../db/backup';
import { closeDatabase, initDatabase } from '../db/database';
import { getSession } from '../db/database';

let handlersRegistered = false;

export function registerBackupIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle('backup:create', async (_event, token: string) => {
    const session = getSession(token);
    if (!session) {
      throw new Error('Unauthorized');
    }
    if (session.role !== 'admin' && session.role !== 'manager') {
      throw new Error('Only admin or manager can create backups');
    }
    return createBackup();
  });

  ipcMain.handle('backup:list', async (_event, token: string) => {
    const session = getSession(token);
    if (!session) {
      throw new Error('Unauthorized');
    }
    if (session.role !== 'admin' && session.role !== 'manager') {
      throw new Error('Only admin or manager can list backups');
    }
    return listBackups();
  });

  ipcMain.handle('backup:restore', async (_event, token: string, backupPath: string) => {
    const session = getSession(token);
    if (!session) {
      throw new Error('Unauthorized');
    }
    if (session.role !== 'admin') {
      throw new Error('Only admin can restore backups');
    }

    // Close current database connection
    await closeDatabase();

    // Restore backup
    await restoreBackup(backupPath);

    // Reinitialize database
    await initDatabase();

    // Relaunch the application to ensure clean state
    app.relaunch();
    app.exit(0);

    return true;
  });

  ipcMain.handle('backup:delete', async (_event, token: string, backupPath: string) => {
    const session = getSession(token);
    if (!session) {
      throw new Error('Unauthorized');
    }
    if (session.role !== 'admin' && session.role !== 'manager') {
      throw new Error('Only admin or manager can delete backups');
    }
    await deleteBackup(backupPath);
    return true;
  });

  ipcMain.handle('backup:getDir', async (_event, token: string) => {
    const session = getSession(token);
    if (!session) {
      throw new Error('Unauthorized');
    }
    if (session.role !== 'admin' && session.role !== 'manager') {
      throw new Error('Only admin or manager can view backup directory');
    }
    return getBackupDirPath();
  });

  ipcMain.handle('backup:selectFile', async (event, token: string) => {
    const session = getSession(token);
    if (!session) {
      throw new Error('Unauthorized');
    }
    if (session.role !== 'admin') {
      throw new Error('Only admin can select backup files');
    }

    // Get the main window for the dialog
    const allWindows = BrowserWindow.getAllWindows();
    const mainWin = allWindows[0] || undefined;

    const result = dialog.showOpenDialogSync(mainWin, {
      title: 'Select Backup File',
      filters: [
        { name: 'Database Files', extensions: ['db'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result && result.length > 0) {
      return result[0];
    }
    return null;
  });

  handlersRegistered = true;
}

