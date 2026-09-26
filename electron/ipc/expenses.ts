import { ipcMain } from 'electron';
import {
  listExpenses,
  createExpense,
  deleteExpense,
  getExpenseSummary,
  logActivity,
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
      const result = await createExpense({ ...payload, enteredBy: session.userId });
      await logActivity(session.userId, 'create', 'expense', result.id, {
        amountIQD: payload.amountIQD,
        category: payload.category,
        branchId: payload.branchId,
        expenseDate: payload.expenseDate,
      });
      return result;
    }),
  );

  ipcMain.handle(
    'expenses:delete',
    requireRole(['admin'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const expenseId = args[0] as number;
      await deleteExpense(expenseId);
      await logActivity(session.userId, 'delete', 'expense', expenseId);
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

