import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Pages.css';
import './BranchesPage.css';

type Branch = import('../types/electron').Branch;
type BranchInput = import('../types/electron').BranchInput;
type BranchUpdateInput = import('../types/electron').BranchUpdateInput;

const BranchesPage = (): JSX.Element => {
  const { token } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<Partial<BranchInput & { id?: number; isActive?: boolean }>>({
    name: '',
    address: '',
    phone: '',
    currency: 'IQD',
  });

  useEffect(() => {
    loadBranches();
  }, [token]);

  const loadBranches = async () => {
    if (!window.evaApi || !token) {
      setError('Desktop bridge unavailable.');
      return;
    }

    try {
      setLoading(true);
      const data = await window.evaApi.branches.list(token);
      setBranches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load branches.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        id: branch.id,
        name: branch.name,
        address: branch.address || '',
        phone: branch.phone || '',
        currency: branch.currency,
        isActive: branch.isActive,
      });
    } else {
      setEditingBranch(null);
      setFormData({
        name: '',
        address: '',
        phone: '',
        currency: 'IQD',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingBranch(null);
    setFormData({
      name: '',
      address: '',
      phone: '',
      currency: 'IQD',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.evaApi || !token) return;

    try {
      setLoading(true);
      if (editingBranch) {
        const updateData: BranchUpdateInput = {
          id: editingBranch.id,
          name: formData.name!,
          address: formData.address,
          phone: formData.phone,
          currency: formData.currency,
          isActive: formData.isActive,
        };
        await window.evaApi.branches.update(token, updateData);
      } else {
        if (!formData.name) {
          alert('Branch name is required');
          return;
        }
        const createData: BranchInput = {
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          currency: formData.currency,
        };
        await window.evaApi.branches.create(token, createData);
      }
      await loadBranches();
      handleCloseModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save branch');
    } finally {
      setLoading(false);
    }
  };

  if (loading && branches.length === 0) {
    return (
      <div className="Page">
        <div className="Page-header">
          <h1>Branch Management</h1>
        </div>
        <div className="Page-content">Loading...</div>
      </div>
    );
  }

  return (
    <div className="Page Branches">
      <div className="Page-header">
        <h1>Branch Management</h1>
        <button className="Branches-addButton" onClick={() => handleOpenModal()}>
          + Add Branch
        </button>
      </div>

      {error && <div className="Branches-error">{error}</div>}

      <div className="Page-content">
        <div className="Branches-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Currency</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id}>
                  <td>{branch.name}</td>
                  <td>{branch.address || '-'}</td>
                  <td>{branch.phone || '-'}</td>
                  <td>{branch.currency}</td>
                  <td>
                    {branch.isActive ? (
                      <span className="Branches-status Branches-status-active">Active</span>
                    ) : (
                      <span className="Branches-status Branches-status-inactive">Inactive</span>
                    )}
                  </td>
                  <td>
                    <button className="Branches-edit" onClick={() => handleOpenModal(branch)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="Branches-modalOverlay" onClick={handleCloseModal}>
          <div className="Branches-modal" onClick={(e) => e.stopPropagation()}>
            <div className="Branches-modalHeader">
              <h2>{editingBranch ? 'Edit Branch' : 'Add Branch'}</h2>
              <button className="Branches-modalClose" onClick={handleCloseModal}>
                ✕
              </button>
            </div>
            <form className="Branches-form" onSubmit={handleSubmit}>
              <div className="Branches-formGroup">
                <label>Branch Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="Branches-formGroup">
                <label>Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="Branches-formGroup">
                <label>Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="Branches-formGroup">
                <label>Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                >
                  <option value="IQD">IQD</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              {editingBranch && (
                <div className="Branches-formGroup">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isActive ?? true}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
              )}

              <div className="Branches-formActions">
                <button type="button" className="Branches-cancel" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="Branches-save" disabled={loading}>
                  {loading ? 'Saving...' : editingBranch ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchesPage;

