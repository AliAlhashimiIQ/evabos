import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Pages.css';
import './UsersPage.css';

type User = import('../types/electron').User;
type UserInput = import('../types/electron').UserInput;
type UserUpdateInput = import('../types/electron').UserUpdateInput;
type Branch = import('../types/electron').Branch;

const UsersPage = (): JSX.Element => {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<UserInput & { id?: number; isLocked?: boolean }>>({
    username: '',
    password: '',
    role: 'cashier',
    branchId: null,
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
      const [usersData, branchesData] = await Promise.all([
        window.evaApi.users.list(token),
        window.evaApi.branches.list(token),
      ]);
      setUsers(usersData);
      setBranches(branchesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        id: user.id,
        username: user.username,
        role: user.role,
        branchId: user.branchId,
        isLocked: user.isLocked,
        password: '', // Don't prefill password
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        role: 'cashier',
        branchId: null,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      role: 'cashier',
      branchId: null,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.evaApi || !token) return;

    try {
      setLoading(true);
      if (editingUser) {
        const updateData: UserUpdateInput = {
          id: editingUser.id,
          username: formData.username,
          role: formData.role,
          branchId: formData.branchId ?? null,
          isLocked: formData.isLocked,
        };
        if (formData.password && formData.password.trim()) {
          updateData.password = formData.password;
        }
        await window.evaApi.users.update(token, updateData);
      } else {
        if (!formData.username || !formData.password) {
          alert('Username and password are required');
          return;
        }
        const createData: UserInput = {
          username: formData.username,
          password: formData.password,
          role: formData.role || 'cashier',
          branchId: formData.branchId ?? null,
        };
        await window.evaApi.users.create(token, createData);
      }
      await loadData();
      handleCloseModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: number, username: string) => {
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

  if (loading && users.length === 0) {
    return (
      <div className="Page">
        <div className="Page-header">
          <h1>User Management</h1>
        </div>
        <div className="Page-content">Loading...</div>
      </div>
    );
  }

  return (
    <div className="Page Users">
      <div className="Page-header">
        <h1>User Management</h1>
        <button className="Users-addButton" onClick={() => handleOpenModal()}>
          + Add User
        </button>
      </div>

      {error && <div className="Users-error">{error}</div>}

      <div className="Page-content">
        <div className="Users-table">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>
                    <span className={`Users-role Users-role-${user.role}`}>{user.role}</span>
                  </td>
                  <td>{user.branchName || 'No Branch'}</td>
                  <td>
                    {user.isLocked ? (
                      <span className="Users-status Users-status-locked">Locked</span>
                    ) : (
                      <span className="Users-status Users-status-active">Active</span>
                    )}
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="Users-actions">
                      <button className="Users-edit" onClick={() => handleOpenModal(user)}>
                        Edit
                      </button>
                      {user.username !== 'admin' && (
                        <button
                          className="Users-delete"
                          onClick={() => handleDelete(user.id, user.username)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="Users-modalOverlay" onClick={handleCloseModal}>
          <div className="Users-modal" onClick={(e) => e.stopPropagation()}>
            <div className="Users-modalHeader">
              <h2>{editingUser ? 'Edit User' : 'Add User'}</h2>
              <button className="Users-modalClose" onClick={handleCloseModal}>
                ✕
              </button>
            </div>
            <form className="Users-form" onSubmit={handleSubmit}>
              <div className="Users-formGroup">
                <label>Username *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  disabled={!!editingUser}
                />
              </div>

              <div className="Users-formGroup">
                <label>Password {editingUser ? '(leave blank to keep current)' : '*'}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                />
              </div>

              <div className="Users-formGroup">
                <label>Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as 'admin' | 'manager' | 'cashier' })
                  }
                  required
                >
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="Users-formGroup">
                <label>Branch</label>
                <select
                  value={formData.branchId ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
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
                      checked={formData.isLocked || false}
                      onChange={(e) => setFormData({ ...formData, isLocked: e.target.checked })}
                    />
                    Lock Account
                  </label>
                </div>
              )}

              <div className="Users-formActions">
                <button type="button" className="Users-cancel" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="Users-save" disabled={loading}>
                  {loading ? 'Saving...' : editingUser ? 'Update' : 'Create'}
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

