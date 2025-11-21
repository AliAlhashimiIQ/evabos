import { ipcMain } from 'electron';
import {
  listExpenses,
  createExpense,
  deleteExpense,
  getExpenseSummary,
} from '../db/database';
import type { ExpenseInput, DateRange } from '../db/types';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerExpensesIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle(
    'expenses:list',
    requireRole(['admin', 'manager'])(async () => {
      return listExpenses();
    }),
  );

  ipcMain.handle(
    'expenses:create',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as ExpenseInput;
      return createExpense({ ...payload, enteredBy: session.userId });
    }),
  );

  ipcMain.handle(
    'expenses:delete',
    requireRole(['admin'])(async (_event, _session, ...args) => {
      const expenseId = args[0] as number;
      await deleteExpense(expenseId);
      return true;
    }),
  );

  ipcMain.handle(
    'expenses:summary',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const range = args[0] as DateRange;
      return getExpenseSummary(range);
    }),
  );

  handlersRegistered = true;
}

