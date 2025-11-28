import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import './Pages.css';
import './CustomersPage.css';

type Customer = import('../types/electron').Customer;
type CustomerInput = import('../types/electron').CustomerInput;
type CustomerHistoryEntry = import('../types/electron').CustomerHistoryEntry;

const defaultForm: CustomerInput = {
  name: '',
  phone: '',
  notes: '',
};

const CustomersPage = (): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<CustomerHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<CustomerInput>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | '30' | '90'>('all');

  const loadCustomers = async () => {
    if (!window.evaApi || !token) return;
    try {
      setLoading(true);
      setError(null);
      const response = await window.evaApi.customers.list(token);
      setCustomers(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadCustomers'));
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (customerId: number) => {
    if (!window.evaApi || !token) return;
    try {
      const response = await window.evaApi.customers.history(token, customerId);
      setHistory(response);
    } catch (err) {
      console.error('Failed to load history', err);
      setError(t('failedToLoadHistory'));
    }
  };

  useEffect(() => {
    if (token) {
      loadCustomers();
    }
  }, [token]);

  useEffect(() => {
    if (selectedCustomer) {
      loadHistory(selectedCustomer.id);
    } else {
      setHistory([]);
    }
  }, [selectedCustomer]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return history;
    const days = Number(historyFilter);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return history.filter((entry) => new Date(entry.saleDate).getTime() >= cutoff);
  }, [history, historyFilter]);

  const loyaltyTier = (points: number) => {
    if (points > 200) return t('platinum');
    if (points > 100) return t('gold');
    if (points > 50) return t('silver');
    if (points > 10) return t('bronze');
    return t('new');
  };

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const term = search.toLowerCase();
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) || customer.phone?.toLowerCase().includes(term),
    );
  }, [customers, search]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.name.trim()) {
      setError(t('customerNameRequired'));
      return;
    }
    if (!window.evaApi) return;
    try {
      setSubmitting(true);
      setError(null);
      await window.evaApi.customers.create(token!, formState);
      setFormState(defaultForm);
      setModalOpen(false);
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToCreateCustomer'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="Page Page--transparent CustomersPage">
      <div className="CustomersPage-header">
        <div>
          <h1>{t('customersLoyalty')}</h1>
          <p>{t('trackLoyalty')}</p>
        </div>
        <div className="CustomersPage-actions">
          <input
            type="search"
            placeholder={t('searchCustomers')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button onClick={() => setModalOpen(true)}>+ {t('newCustomer')}</button>
        </div>
      </div>

      {error && <div className="CustomersPage-alert">{error}</div>}

      <div className="CustomersPage-content">
        <aside className="CustomersPage-list">
          {loading ? (
            <div className="CustomersPage-empty">{t('loadingCustomers')}</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="CustomersPage-empty">{t('noCustomersMatch')}</div>
          ) : (
            <ul>
              {filteredCustomers.map((customer) => (
                <li
                  key={customer.id}
                  className={selectedCustomer?.id === customer.id ? 'active' : ''}
                  onClick={() => setSelectedCustomer(customer)}
                >
                  <strong>{customer.name}</strong>
                  <span>{customer.phone ?? t('noPhone')}</span>
                  <small>
                    {t('visits')}: {customer.totalVisits} | {t('spent')}: {customer.totalSpentIQD.toLocaleString('en-IQ')} IQD
                  </small>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="CustomersPage-details">
          {selectedCustomer ? (
            <>
              <header>
                <div>
                  <h2>{selectedCustomer.name}</h2>
                  <p>{selectedCustomer.phone ?? t('noPhoneOnFile')}</p>
                  <span className={`CustomersPage-tier tier-${loyaltyTier(selectedCustomer.loyaltyPoints).toLowerCase()}`}>
                    {loyaltyTier(selectedCustomer.loyaltyPoints)}
                  </span>
                </div>
                <div className="CustomersPage-actions-header">
                  <button
                    className="delete-btn"
                    onClick={async () => {
                      if (window.confirm(t('confirmDeleteCustomer'))) {
                        try {
                          await window.evaApi.customers.delete(token!, selectedCustomer.id);
                          setSelectedCustomer(null);
                          loadCustomers();
                        } catch (err) {
                          setError(t('failedToDeleteCustomer'));
                        }
                      }
                    }}
                  >
                    {t('delete')}
                  </button>
                </div>
                <div className="CustomersPage-metrics">
                  <div>
                    <span>{t('totalSpent')}</span>
                    <strong>{selectedCustomer.totalSpentIQD.toLocaleString('en-IQ')} IQD</strong>
                  </div>
                  <div>
                    <span>{t('visits')}</span>
                    <strong>{selectedCustomer.totalVisits}</strong>
                  </div>
                  <div>
                    <span>{t('loyaltyPoints')}</span>
                    <strong>{selectedCustomer.loyaltyPoints.toFixed(1)}</strong>
                  </div>
                </div>
              </header>

              <section className="CustomersPage-history">
                <div className="CustomersPage-historyHeader">
                  <h3>{t('purchaseHistory')}</h3>
                  <select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as typeof historyFilter)}>
                    <option value="all">{t('all')}</option>
                    <option value="30">{t('last30days')}</option>
                    <option value="90">{t('last90days')}</option>
                  </select>
                </div>
                {filteredHistory.length === 0 ? (
                  <div className="CustomersPage-empty">{t('noRecordedPurchases')}</div>
                ) : (
                  <div className="CustomersPage-historyList">
                    {filteredHistory.map((entry) => (
                      <article key={entry.saleId}>
                        <header>
                          <div>
                            <strong>{t('sale')} #{entry.saleId}</strong>
                            <span>{new Date(entry.saleDate).toLocaleString()}</span>
                          </div>
                          <div>
                            <span>{entry.paymentMethod ?? t('unknownMethod')}</span>
                            <strong>{entry.totalIQD.toLocaleString('en-IQ')} IQD</strong>
                          </div>
                        </header>
                        <ul>
                          {entry.items.map((item) => (
                            <li key={`${entry.saleId}-${item.variantId}`}>
                              <span>
                                {item.productName} – {item.color ?? t('any')} / {item.size ?? t('any')}
                              </span>
                              <span>
                                {item.quantity} × {item.lineTotalIQD.toLocaleString('en-IQ')} IQD
                              </span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="CustomersPage-empty">{t('selectCustomerToView')}</div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="CustomersPage-modalOverlay">
          <div className="CustomersPage-modal">
            <header>
              <h3>{t('addCustomer')}</h3>
              <button onClick={() => setModalOpen(false)}>✕</button>
            </header>
            <form onSubmit={handleSubmit}>
              <label>
                <span>{t('name')}</span>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  required
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
              <label className="CustomersPage-span">
                <span>{t('notes')}</span>
                <textarea
                  rows={3}
                  value={formState.notes ?? ''}
                  onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>
              <div className="CustomersPage-actions">
                <button type="button" className="ghost" onClick={() => setModalOpen(false)}>
                  {t('cancel')}
                </button>
                <button type="submit" disabled={submitting}>
                  {submitting ? t('saving') : t('saveCustomer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersPage;

