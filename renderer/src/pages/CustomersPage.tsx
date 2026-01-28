import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Plus, Ticket, X, Check, Printer } from 'lucide-react';
import './Pages.css';
import './CustomersPage.css';
import { confirmDialog } from '../utils/confirmDialog';

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
    const [voucherModalOpen, setVoucherModalOpen] = useState(false);
    const [voucherCustomerId, setVoucherCustomerId] = useState<number | ''>('');
    const [voucherDiscount, setVoucherDiscount] = useState<number>(10);
    const [voucherSearch, setVoucherSearch] = useState('');
    const [voucherValidityDays, setVoucherValidityDays] = useState<number>(14);

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

    const generateVoucherHtml = (customer: Customer, discount: number, validityDays: number): string => {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + validityDays);
        const expiryFormatted = expiryDate.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' });

        return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { margin: 0; size: auto; } }
body { font-family: 'Courier New', Courier, monospace; width: 100%; max-width: 72mm; margin: 0; padding: 10px; font-size: 14px; line-height: 1.4; background: #fff; color: #000; text-align: center; direction: rtl; }
.store-name { font-size: 24px; font-weight: 900; margin-bottom: 10px; text-transform: uppercase; border-bottom: 3px solid #000; padding-bottom: 10px; }
.voucher-title { font-size: 18px; font-weight: bold; margin: 15px 0; }
.customer-name { font-size: 16px; margin: 10px 0; }
.discount { font-size: 36px; font-weight: 900; margin: 20px 0; padding: 15px; border: 3px dashed #000; }
.validity { font-size: 14px; font-weight: bold; margin: 15px 0; padding: 10px; background: #f0f0f0; border-radius: 5px; }
.footer { font-size: 12px; margin-top: 20px; padding-top: 10px; border-top: 2px solid #000; padding-bottom: 50px; }
</style>
</head>
<body>
<div class="store-name">EVA CLOTHING</div>
<div class="voucher-title">قسيمة خصم</div>
<div class="customer-name">العميل: <strong>${customer.name}</strong></div>
<div class="discount">${discount}% خصم</div>
<div class="validity">صالحة لمدة ${validityDays} يوم<br />تنتهي في: ${expiryFormatted}</div>
<div class="footer">قدّم هذه القسيمة عند الدفع<br /><br />الشروط والأحكام سارية</div>
</body>
</html>`;
    };

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
                    <button onClick={() => setModalOpen(true)}><Plus size={18} /> {t('newCustomer')}</button>
                    <button onClick={() => setVoucherModalOpen(true)}><Ticket size={18} /> {t('createVoucher')}</button>
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
                                            if (confirmDialog(t('confirmDeleteCustomer'))) {
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
                            <button onClick={() => setModalOpen(false)}><X size={20} /></button>
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

            {/* Voucher Modal */}
            {voucherModalOpen && (
                <div className="CustomersPage-modalOverlay">
                    <div className="CustomersPage-modal" style={{ maxWidth: '450px' }}>
                        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ margin: 0 }}><Ticket size={24} /> {t('createVoucher')}</h2>
                            <button type="button" onClick={() => { setVoucherModalOpen(false); setVoucherSearch(''); setVoucherCustomerId(''); }} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#888' }}><X size={24} /></button>
                        </header>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{t('searchCustomer')}</label>
                            <input type="text" placeholder={t('searchByNameOrPhone')} value={voucherSearch} onChange={(e) => setVoucherSearch(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(148,163,184,0.3)', background: 'rgba(30,41,59,0.5)', color: '#fff' }} />
                        </div>

                        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                            {customers.filter(c => { if (!voucherSearch.trim()) return true; const term = voucherSearch.toLowerCase(); return c.name.toLowerCase().includes(term) || (c.phone && c.phone.toLowerCase().includes(term)); }).map(c => (
                                <div key={c.id} onClick={() => setVoucherCustomerId(c.id)} style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: voucherCustomerId === c.id ? 'rgba(59,130,246,0.3)' : 'transparent', borderBottom: '1px solid rgba(148,163,184,0.1)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: voucherCustomerId === c.id ? 'bold' : 'normal' }}>{c.name}</span>
                                    <span style={{ color: '#888', fontSize: '0.85rem' }}>{c.phone || ''}</span>
                                </div>
                            ))}
                            {customers.filter(c => { if (!voucherSearch.trim()) return true; const term = voucherSearch.toLowerCase(); return c.name.toLowerCase().includes(term) || (c.phone && c.phone.toLowerCase().includes(term)); }).length === 0 && (
                                <div style={{ padding: '1rem', textAlign: 'center', color: '#888' }}>{t('noCustomersFound')}</div>
                            )}
                        </div>

                        {voucherCustomerId && (
                            <div style={{ padding: '0.5rem 1rem', background: 'rgba(34,197,94,0.1)', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Check size={16} /> {t('selected')}: <strong>{customers.find(c => c.id === voucherCustomerId)?.name}</strong>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{t('discountPercent')}</label>
                                <input type="number" min={1} max={100} value={voucherDiscount} onChange={(e) => setVoucherDiscount(Number(e.target.value))} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(148,163,184,0.3)', background: 'rgba(30,41,59,0.5)', color: '#fff', fontSize: '1.25rem', textAlign: 'center' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>{t('validityDays')}</label>
                                <input type="number" min={1} max={365} value={voucherValidityDays} onChange={(e) => setVoucherValidityDays(Number(e.target.value))} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(148,163,184,0.3)', background: 'rgba(30,41,59,0.5)', color: '#fff', fontSize: '1.25rem', textAlign: 'center' }} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => { setVoucherModalOpen(false); setVoucherSearch(''); setVoucherCustomerId(''); }} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: '1px solid rgba(148,163,184,0.3)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>{t('cancel')}</button>
                            <button type="button" disabled={!voucherCustomerId} onClick={async () => {
                                if (!voucherCustomerId) return;
                                const customer = customers.find(c => c.id === voucherCustomerId);
                                if (customer) {
                                    const html = generateVoucherHtml(customer, voucherDiscount, voucherValidityDays);
                                    try {
                                        await window.evaApi.printing.print({ html, printerName: null, silent: false });
                                        setVoucherModalOpen(false);
                                        setVoucherSearch('');
                                        setVoucherCustomerId('');
                                        setVoucherDiscount(10);
                                        setVoucherValidityDays(14);
                                    } catch (err) {
                                        setError(t('failedToPrintVoucher') || 'Failed to print voucher');
                                    }
                                }
                            }} style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', background: voucherCustomerId ? '#22c55e' : '#555', color: '#fff', cursor: voucherCustomerId ? 'pointer' : 'not-allowed', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}><Printer size={18} /> {t('printVoucher')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomersPage;

