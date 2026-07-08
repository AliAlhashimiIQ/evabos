import { ipcMain } from 'electron';
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeSalesReport,
  getEmployeeDetailedSales,
  logActivity,
} from '../db/database';
import type { EmployeeInput } from '../db/types';
import { requireRole } from './auth';

let handlersRegistered = false;

export function registerEmployeesIpc(): void {
  if (handlersRegistered) {
    return;
  }

  ipcMain.handle(
    'employees:list',
    requireRole(['admin', 'manager', 'cashier'])(async (_event, _session, ...args) => {
      const includeInactive = args[0] as boolean | undefined;
      return listEmployees(includeInactive);
    }),
  );

  ipcMain.handle(
    'employees:create',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const payload = args[0] as EmployeeInput;
      const employee = await createEmployee(payload);
      await logActivity(session.userId, 'create', 'employee', employee.id);
      return employee;
    }),
  );

  ipcMain.handle(
    'employees:update',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const { id, data } = args[0] as { id: number; data: Partial<EmployeeInput> };
      const employee = await updateEmployee(id, data);
      await logActivity(session.userId, 'update', 'employee', employee.id);
      return employee;
    }),
  );

  ipcMain.handle(
    'employees:delete',
    requireRole(['admin', 'manager'])(async (_event, session, ...args) => {
      if (!session) throw new Error('Unauthorized');
      const id = args[0] as number;
      const hardDeleted = await deleteEmployee(id);
      await logActivity(session.userId, hardDeleted ? 'delete' : 'deactivate', 'employee', id);
      return hardDeleted;
    }),
  );

  ipcMain.handle(
    'reports:employeeSales',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const { startDate, endDate } = args[0] as { startDate: string; endDate: string };
      return getEmployeeSalesReport(startDate, endDate);
    }),
  );

  ipcMain.handle(
    'reports:employeeDetailedSales',
    requireRole(['admin', 'manager'])(async (_event, _session, ...args) => {
      const { employeeId, startDate, endDate } = args[0] as { employeeId: number | null; startDate: string; endDate: string };
      return getEmployeeDetailedSales(employeeId, startDate, endDate);
    }),
  );

  handlersRegistered = true;
}
