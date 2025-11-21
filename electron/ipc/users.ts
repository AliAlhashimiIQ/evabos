import { ipcMain } from 'electron';
import { listUsers, createUser, updateUser, deleteUser } from '../db/database';
import type { UserInput, UserUpdateInput } from '../db/types';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerUsersIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle(
    'users:list',
    requireRole(['admin', 'manager'])(async () => {
      return listUsers();
    }),
  );

  ipcMain.handle(
    'users:create',
    requireRole(['admin'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as UserInput;
      const user = await createUser(payload);
      // Log activity
      const { logActivity } = await import('../db/database');
      await logActivity(session.userId, 'create', 'user', user.id);
      return user;
    }),
  );

  ipcMain.handle(
    'users:update',
    requireRole(['admin'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as UserUpdateInput;
      
      // Prevent user from deleting themselves
      if (payload.id === session.userId && payload.isLocked === true) {
        throw new Error('Cannot lock your own account');
      }
      
      const user = await updateUser(payload);
      await (await import('../db/database')).logActivity(session.userId, 'update', 'user', user.id);
      return user;
    }),
  );

  ipcMain.handle(
    'users:delete',
    requireRole(['admin'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const userId = args[0] as number;
      
      // Prevent user from deleting themselves
      if (userId === session.userId) {
        throw new Error('Cannot delete your own account');
      }
      
      await deleteUser(userId);
      await (await import('../db/database')).logActivity(session.userId, 'delete', 'user', userId);
      return true;
    }),
  );

  handlersRegistered = true;
}

