import { ipcMain } from 'electron';
import { listBranches, createBranch, updateBranch } from '../db/database';
import type { BranchInput, BranchUpdateInput } from '../db/types';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerBranchesIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle(
    'branches:list',
    requireRole(['admin', 'manager'])(async () => {
      return listBranches();
    }),
  );

  ipcMain.handle(
    'branches:create',
    requireRole(['admin'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as BranchInput;
      const branch = await createBranch(payload);
      await (await import('../db/database')).logActivity(session.userId, 'create', 'branch', branch.id);
      return branch;
    }),
  );

  ipcMain.handle(
    'branches:update',
    requireRole(['admin'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as BranchUpdateInput;
      const branch = await updateBranch(payload);
      await (await import('../db/database')).logActivity(session.userId, 'update', 'branch', branch.id);
      return branch;
    }),
  );

  handlersRegistered = true;
}

