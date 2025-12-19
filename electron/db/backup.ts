import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

export interface BackupInfo {
  filename: string;
  filepath: string;
  size: number;
  createdAt: string;
}

const BACKUP_DIR_NAME = 'EVA_POS';
const BACKUP_SUBDIR = 'Backup';

const getBackupDir = (): string => {
  if (!app.isReady()) {
    throw new Error('App not ready');
  }
  const documentsPath = app.getPath('documents');
  const backupDir = path.join(documentsPath, BACKUP_DIR_NAME, BACKUP_SUBDIR);
  return backupDir;
};

const getDbPath = (): string => {
  if (!app.isReady()) {
    throw new Error('App not ready');
  }

  // IMPORTANT: This MUST match the logic in database.ts resolveDbPath()
  // Check if running as a Portable App (electron-builder sets this env var)
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    const portablePath = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'eva-pos.db');
    log.info('[backup] Using PORTABLE database path:', portablePath);
    return portablePath;
  }

  // Standard Install (NSIS) & Development: Use UserData (Persists across updates)
  const userDataPath = path.join(app.getPath('userData'), 'eva-pos.db');
  log.info('[backup] Using userData database path:', userDataPath);
  return userDataPath;
};

export async function ensureBackupDir(): Promise<string> {
  const backupDir = getBackupDir();
  try {
    await fs.mkdir(backupDir, { recursive: true });
  } catch (err) {
    log.error('Failed to create backup directory:', err);
    throw err;
  }
  return backupDir;
}

export async function createBackup(): Promise<BackupInfo> {
  const dbPath = getDbPath();
  const backupDir = await ensureBackupDir();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
  const filename = `eva-pos-backup-${timestamp}.db`;
  const backupPath = path.join(backupDir, filename);

  try {
    await fs.copyFile(dbPath, backupPath);
    const stats = await fs.stat(backupPath);

    return {
      filename,
      filepath: backupPath,
      size: stats.size,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    log.error('Failed to create backup:', err);
    throw new Error(`Failed to create backup: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function listBackups(): Promise<BackupInfo[]> {
  const backupDir = await ensureBackupDir();

  try {
    const files = await fs.readdir(backupDir);
    const backupFiles = files.filter((f) => f.startsWith('eva-pos-backup-') && f.endsWith('.db'));

    const backups: BackupInfo[] = [];
    for (const file of backupFiles) {
      const filepath = path.join(backupDir, file);
      try {
        const stats = await fs.stat(filepath);
        backups.push({
          filename: file,
          filepath,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
        });
      } catch {
        // Skip files that can't be accessed
      }
    }

    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    log.error('Failed to list backups:', err);
    return [];
  }
}

export async function restoreBackup(backupPath: string): Promise<void> {
  const dbPath = getDbPath();

  try {
    // Check if backup file exists
    await fs.access(backupPath);

    // Close current database connection if open
    // (This should be handled by the caller)

    // Create a backup of current DB before restoring
    const currentBackupPath = `${dbPath}.pre-restore-${Date.now()}`;
    try {
      await fs.copyFile(dbPath, currentBackupPath);
    } catch {
      // If current DB doesn't exist, that's okay
    }

    // Copy backup to database location
    await fs.copyFile(backupPath, dbPath);

    // Clean up pre-restore backup after a short delay (optional)
    // We'll leave it for manual cleanup if needed
  } catch (err) {
    log.error('Failed to restore backup:', err);
    throw new Error(`Failed to restore backup: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function deleteBackup(backupPath: string): Promise<void> {
  try {
    await fs.unlink(backupPath);
  } catch (err) {
    log.error('Failed to delete backup:', err);
    throw new Error(`Failed to delete backup: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export function getBackupDirPath(): string {
  return getBackupDir();
}

