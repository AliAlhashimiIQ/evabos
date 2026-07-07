import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './Pages.css';
import './UsersPage.css';

type User = import('../types/electron').User;
type UserInput = import('../types/electron').UserInput;
type UserUpdateInput = import('../types/electron').UserUpdateInput;
type Branch = import('../types/electron').Branch;
type Employee = import('../types/electron').Employee;
type EmployeeInput = import('../types/electron').EmployeeInput;

const UsersPage = (): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'users' | 'employees'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState<Partial<UserInput & { id?: number; isLocked?: boolean }>>({
    username: '',
    password: '',
    role: 'cashier',
    branchId: null,
  });

  // Employee modal state
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState<Partial<EmployeeInput & { id?: number }>>({
    name: '',
    phone: '',
    isActive: true,
  });

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    if (!window.evaApi || !token) {
      setError('Desktop bridge unavailable.');
      return;
    }

    try {
      setLoading(true);
      const [usersData, branchesData, employeesData] = await Promise.all([
        window.evaApi.users.list(token),
        window.evaApi.branches.list(token),
        window.evaApi.employees.list(token, true), // include inactive
      ]);
      setUsers(usersData);
      setBranches(branchesData);
      setEmployees(employeesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  // User Actions
  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setUserFormData({
        id: user.id,
        username: user.username,
        role: user.role,
        branchId: user.branchId,
        isLocked: user.isLocked,
        password: '', // Don't prefill password
      });
    } else {
      setEditingUser(null);
      setUserFormData({
        username: '',
        password: '',
        role: 'cashier',
        branchId: null,
      });
    }
    setShowUserModal(true);
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
    setUserFormData({
      username: '',
      password: '',
      role: 'cashier',
      branchId: null,
    });
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.evaApi || !token) return;

    try {
      setLoading(true);
      if (editingUser) {
        const updateData: UserUpdateInput = {
          id: editingUser.id,
          username: userFormData.username,
          role: userFormData.role,
          branchId: userFormData.branchId ?? null,
          isLocked: userFormData.isLocked,
        };
        if (userFormData.password && userFormData.password.trim()) {
          updateData.password = userFormData.password;
        }
        await window.evaApi.users.update(token, updateData);
      } else {
        if (!userFormData.username || !userFormData.password) {
          alert('Username and password are required');
          return;
        }
        const createData: UserInput = {
          username: userFormData.username,
          password: userFormData.password,
          role: userFormData.role || 'cashier',
          branchId: userFormData.branchId ?? null,
        };
        await window.evaApi.users.create(token, createData);
      }
      await loadData();
      handleCloseUserModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleUserDelete = async (userId: number, username: string) => {
    if (!window.evaApi || !token) return;
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

    try {
      setLoading(true);
      await window.evaApi.users.delete(token, userId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  // Employee Actions
  const handleOpenEmployeeModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmployee(emp);
      setEmployeeFormData({
        id: emp.id,
        name: emp.name,
        phone: emp.phone ?? '',
        isActive: emp.isActive,
      });
    } else {
      setEditingEmployee(null);
      setEmployeeFormData({
        name: '',
        phone: '',
        isActive: true,
      });
    }
    setShowEmployeeModal(true);
  };

  const handleCloseEmployeeModal = () => {
    setShowEmployeeModal(false);
    setEditingEmployee(null);
    setEmployeeFormData({
      name: '',
      phone: '',
      isActive: true,
    });
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.evaApi || !token) return;

    if (!employeeFormData.name || !employeeFormData.name.trim()) {
      alert(t('employeeNameRequired'));
      return;
    }

    try {
      setLoading(true);
      if (editingEmployee) {
        await window.evaApi.employees.update(token, editingEmployee.id, {
          name: employeeFormData.name.trim(),
          phone: employeeFormData.phone?.trim() || null,
          isActive: employeeFormData.isActive,
        });
      } else {
        await window.evaApi.employees.create(token, {
          name: employeeFormData.name.trim(),
          phone: employeeFormData.phone?.trim() || null,
          isActive: employeeFormData.isActive !== false,
        });
      }
      await loadData();
      handleCloseEmployeeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeDelete = async (empId: number, name: string) => {
    if (!window.evaApi || !token) return;
    if (!confirm(`Are you sure you want to delete employee "${name}"?`)) return;

    try {
      setLoading(true);
      const hardDeleted = await window.evaApi.employees.delete(token, empId);
      if (!hardDeleted) {
        alert(t('employeeLinkedToSales') || 'Employee has sale records, so they have been marked as Inactive instead of deleted.');
      }
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete employee');
    } finally {
      setLoading(false);
    }
  };

  if (loading && users.length === 0 && employees.length === 0) {
    return (
      <div className="Page">
        <div className="Page-header">
          <h1>{t('users') || 'User Management'}</h1>
        </div>
        <div className="Page-content">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="Page Users">
      <div className="Page-header">
        <h1>{activeTab === 'users' ? t('users') : t('employees')}</h1>
        {activeTab === 'users' ? (
          <button className="Users-addButton" onClick={() => handleOpenUserModal()}>
            + {t('addUser') || 'Add User'}
          </button>
        ) : (
          <button className="Users-addButton" onClick={() => handleOpenEmployeeModal()}>
            + {t('addEmployee')}
          </button>
        )}
      </div>

      {error && <div className="Users-error">{error}</div>}

      <div className="Page-content">
        {/* Tab Selection */}
        <div className="Users-tabs">
          <button
            type="button"
            className={`Users-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            {t('users') || 'System Logins'}
          </button>
          <button
            type="button"
            className={`Users-tab ${activeTab === 'employees' ? 'active' : ''}`}
            onClick={() => setActiveTab('employees')}
          >
            {t('employees')}
          </button>
        </div>

        {activeTab === 'users' ? (
          <div className="Users-table">
            <table>
              <thead>
                <tr>
                  <th>{t('username') || 'Username'}</th>
                  <th>{t('role') || 'Role'}</th>
                  <th>{t('branch') || 'Branch'}</th>
                  <th>{t('status') || 'Status'}</th>
                  <th>{t('created') || 'Created'}</th>
                  <th>{t('actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>
                      <span className={`Users-role Users-role-${user.role}`}>{user.role}</span>
                    </td>
                    <td>{user.branchName || t('notAssigned') || 'No Branch'}</td>
                    <td>
                      {user.isLocked ? (
                        <span className="Users-status Users-status-locked">{t('locked') || 'Locked'}</span>
                      ) : (
                        <span className="Users-status Users-status-active">{t('active') || 'Active'}</span>
                      )}
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="Users-actions">
                        <button className="Users-edit" onClick={() => handleOpenUserModal(user)}>
                          {t('edit')}
                        </button>
                        {user.username !== 'admin' && (
                          <button
                            className="Users-delete"
                            onClick={() => handleUserDelete(user.id, user.username)}
                          >
                            {t('delete')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="Users-table">
            <table>
              <thead>
                <tr>
                  <th>{t('employeeName')}</th>
                  <th>{t('phone')}</th>
                  <th>{t('status')}</th>
                  <th>{t('created')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td>{emp.name}</td>
                    <td>{emp.phone || '-'}</td>
                    <td>
                      {emp.isActive ? (
                        <span className="Users-status Users-status-active">{t('active')}</span>
                      ) : (
                        <span className="Users-status Users-status-locked">{t('inactive')}</span>
                      )}
                    </td>
                    <td>{new Date(emp.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="Users-actions">
                        <button className="Users-edit" onClick={() => handleOpenEmployeeModal(emp)}>
                          {t('edit')}
                        </button>
                        <button
                          className="Users-delete"
                          onClick={() => handleEmployeeDelete(emp.id, emp.name)}
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>
                      {t('noEmployeesYet')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="Users-modalOverlay" onClick={handleCloseUserModal}>
          <div className="Users-modal" onClick={(e) => e.stopPropagation()}>
            <div className="Users-modalHeader">
              <h2>{editingUser ? t('edit') : t('add')} {t('users')}</h2>
              <button className="Users-modalClose" onClick={handleCloseUserModal}>
                ✕
              </button>
            </div>
            <form className="Users-form" onSubmit={handleUserSubmit}>
              <div className="Users-formGroup">
                <label>{t('username')} *</label>
                <input
                  type="text"
                  value={userFormData.username}
                  onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                  required
                  disabled={!!editingUser}
                />
              </div>

              <div className="Users-formGroup">
                <label>{t('password')} {editingUser ? '(leave blank to keep current)' : '*'}</label>
                <input
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  required={!editingUser}
                />
              </div>

              <div className="Users-formGroup">
                <label>{t('role') || 'Role'} *</label>
                <select
                  value={userFormData.role}
                  onChange={(e) =>
                    setUserFormData({ ...userFormData, role: e.target.value as 'admin' | 'manager' | 'cashier' })
                  }
                  required
                >
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="Users-formGroup">
                <label>{t('branch') || 'Branch'}</label>
                <select
                  value={userFormData.branchId ?? ''}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      branchId: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                >
                  <option value="">No Branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>

              {editingUser && (
                <div className="Users-formGroup">
                  <label>
                    <input
                      type="checkbox"
                      checked={userFormData.isLocked || false}
                      onChange={(e) => setUserFormData({ ...userFormData, isLocked: e.target.checked })}
                    />
                    {t('lockPOS') || 'Lock Account'}
                  </label>
                </div>
              )}

              <div className="Users-formActions">
                <button type="button" className="Users-cancel" onClick={handleCloseUserModal}>
                  {t('cancel')}
                </button>
                <button type="submit" className="Users-save" disabled={loading}>
                  {loading ? t('saving') : editingUser ? t('save') : t('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showEmployeeModal && (
        <div className="Users-modalOverlay" onClick={handleCloseEmployeeModal}>
          <div className="Users-modal" onClick={(e) => e.stopPropagation()}>
            <div className="Users-modalHeader">
              <h2>{editingEmployee ? t('editEmployee') : t('addEmployee')}</h2>
              <button className="Users-modalClose" onClick={handleCloseEmployeeModal}>
                ✕
              </button>
            </div>
            <form className="Users-form" onSubmit={handleEmployeeSubmit}>
              <div className="Users-formGroup">
                <label>{t('employeeName')} *</label>
                <input
                  type="text"
                  value={employeeFormData.name || ''}
                  onChange={(e) => setEmployeeFormData({ ...employeeFormData, name: e.target.value })}
                  required
                />
              </div>

              <div className="Users-formGroup">
                <label>{t('phone')}</label>
                <input
                  type="text"
                  value={employeeFormData.phone || ''}
                  onChange={(e) => setEmployeeFormData({ ...employeeFormData, phone: e.target.value })}
                />
              </div>

              <div className="Users-formGroup">
                <label>
                  <input
                    type="checkbox"
                    checked={employeeFormData.isActive !== false}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, isActive: e.target.checked })}
                  />
                  {t('active') || 'Active'}
                </label>
              </div>

              <div className="Users-formActions">
                <button type="button" className="Users-cancel" onClick={handleCloseEmployeeModal}>
                  {t('cancel')}
                </button>
                <button type="submit" className="Users-save" disabled={loading}>
                  {loading ? t('saving') : editingEmployee ? t('save') : t('add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;

