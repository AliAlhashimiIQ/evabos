import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './Pages.css';
import './SuppliersPage.css';

type Supplier = import('../types/electron').Supplier;
type SupplierInput = import('../types/electron').SupplierInput;

const defaultForm: SupplierInput = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  isActive: true,
};

const SuppliersPage = (): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<SupplierInput>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const loadSuppliers = async () => {
    if (!window.evaApi || !token) {
      setError(t('desktopBridgeUnavailable'));
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await window.evaApi.suppliers.list(token);
      setSuppliers(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadSuppliers'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadSuppliers();
    }
  }, [token]);

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormState({
      name: supplier.name,
      contactName: supplier.contactName ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      notes: supplier.notes ?? '',
      isActive: supplier.isActive,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
    setFormState(defaultForm);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.name.trim()) {
      setError(t('supplierNameRequired'));
      return;
    }
    if (!window.evaApi) {
      setError(t('desktopBridgeUnavailable'));
      return;
    }
    try {
      setSubmitting(true);
      setError(null);

      if (editingSupplier) {
        await window.evaApi.suppliers.update(token!, editingSupplier.id, formState);
      } else {
        await window.evaApi.suppliers.create(token!, formState);
      }

      handleCloseModal();
      await loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToCreateSupplier'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="Page Page--transparent SuppliersPage">
      <div className="SuppliersPage-header">
        <div>
          <h1>{t('suppliers')}</h1>
          <p>{t('manageVendorRelationships')}</p>
        </div>
        <button className="SuppliersPage-addButton" onClick={() => setIsModalOpen(true)}>
          + {t('newSupplier')}
        </button>
      </div>

      {error && <div className="SuppliersPage-alert">{error}</div>}

      <div className="SuppliersPage-tableWrapper">
        {loading ? (
          <div className="SuppliersPage-empty">{t('loadingSuppliers')}</div>
        ) : suppliers.length === 0 ? (
          <div className="SuppliersPage-empty">{t('noSuppliersYet')}</div>
        ) : (
          <table className="SuppliersPage-table">
            <thead>
              <tr>
                <th>{t('supplierName')}</th>
                <th>{t('contactName')}</th>
                <th>{t('phone')}</th>
                <th>{t('email')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id}>
                  <td>
                    <strong>{supplier.name}</strong>
                    <small>{supplier.address ?? '—'}</small>
                  </td>
                  <td>{supplier.contactName ?? '—'}</td>
                  <td>{supplier.phone ?? '—'}</td>
                  <td>{supplier.email ?? '—'}</td>
                  <td>
                    <span className={`SuppliersPage-status ${supplier.isActive ? 'active' : 'inactive'}`}>
                      {supplier.isActive ? t('active') : t('inactive')}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button edit-icon"
                      onClick={() => handleEdit(supplier)}
                      title={t('edit')}
                      style={{ marginRight: '0.5rem' }}
                    >
                      ✏️
                    </button>
                    <button
                      className="icon-button delete-icon"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm(t('confirmDeleteSupplier'))) {
                          try {
                            await window.evaApi.suppliers.delete(token!, supplier.id);
                            loadSuppliers();
                          } catch (err) {
                            setError(t('failedToDeleteSupplier'));
                          }
                        }
                      }}
                      title={t('delete')}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="SuppliersPage-modalOverlay">
          <div className="SuppliersPage-modal">
            <header>
              <h3>{editingSupplier ? t('editSupplier') : t('createSupplier')}</h3>
              <button onClick={handleCloseModal}>✕</button>
            </header>
            <form onSubmit={handleSubmit} className="SuppliersPage-form">
              <label>
                <span>{t('supplierName')}</span>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>{t('contactName')}</span>
                <input
                  type="text"
                  value={formState.contactName ?? ''}
                  onChange={(event) => setFormState((prev) => ({ ...prev, contactName: event.target.value }))}
                />
              </label>
              <label>
                <span>{t('phone')}</span>
                <input
                  type="tel"
                  value={formState.phone ?? ''}
                  onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </label>
              <label>
                <span>{t('email')}</span>
                <input
                  type="email"
                  value={formState.email ?? ''}
                  onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
              <label className="SuppliersPage-span">
                <span>{t('address')}</span>
                <textarea
                  rows={2}
                  value={formState.address ?? ''}
                  onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
                />
              </label>
              <label className="SuppliersPage-span">
                <span>{t('notes')}</span>
                <textarea
                  rows={3}
                  value={formState.notes ?? ''}
                  onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>
              <div className="SuppliersPage-actions">
                <button type="button" className="ghost" onClick={handleCloseModal}>
                  {t('cancel')}
                </button>
                <button type="submit" disabled={submitting}>
                  {submitting ? t('saving') : (editingSupplier ? t('updateSupplier') : t('saveSupplier'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;

