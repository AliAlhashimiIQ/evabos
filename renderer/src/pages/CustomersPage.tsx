import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Plus, Ticket, X, Check, Printer, Trash2, Calendar, Award, DollarSign, Loader2 } from 'lucide-react';
import './Pages.css';
import './CustomersPage.css';
import { confirmDialog } from '../utils/confirmDialog';
import { SkeletonList } from '../components/Skeleton';

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

    const generateVoucherHtml = (discount: number, validityDays: number, customerName?: string): string => {
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
<div class="customer-name">${customerName ? `العميل: <strong>${customerName}</strong>` : 'لحامل هذه القسيمة'}</div>
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
                    <button onClick={() => {
                        setVoucherCustomerId(selectedCustomer ? selectedCustomer.id : '');
                        setVoucherSearch('');
                        setVoucherDiscount(10);
                        setVoucherValidityDays(14);
                        setVoucherModalOpen(true);
                    }}><Ticket size={18} /> {t('createVoucher')}</button>
                </div>
            </div>

            {error && <div className="CustomersPage-alert">{error}</div>}

            <div className="CustomersPage-content">
                <aside className="CustomersPage-list">
                    {loading ? (
                        <SkeletonList items={5} />
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
                            <div className="CustomersPage-detailsHeader">
                                <div className="CustomersPage-detailsInfo">
                                    <h2>{selectedCustomer.name}</h2>
                                    <p>{selectedCustomer.phone ?? t('noPhoneOnFile')}</p>
                                    <span className={`CustomersPage-tier tier-${loyaltyTier(selectedCustomer.loyaltyPoints).toLowerCase()}`}>
                                        {loyaltyTier(selectedCustomer.loyaltyPoints)}
                                    </span>
                                </div>
                                <div className="CustomersPage-actions-header">
                                    <button
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            color: '#ef4444',
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                            borderRadius: '0.5rem',
                                            padding: '0.45rem 0.85rem',
                                            fontSize: '0.82rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            transition: 'all 0.15s ease'
                                        }}
                                        onClick={async () => {
                                            if (await confirmDialog({ message: t('confirmDeleteCustomer'), variant: 'danger', confirmText: t('delete') })) {
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
                                        <Trash2 size={14} />
                                        <span>{t('delete')}</span>
                                    </button>
                                </div>
                            </div>

                            <div className="CustomersPage-metrics">
                                <div className="CustomersPage-metricCard CustomersPage-metricCard--spent">
                                    <div className="CustomersPage-metricCard-label">
                                        <DollarSign size={14} />
                                        <span>{t('totalSpent') || 'Total Spent'}</span>
                                    </div>
                                    <strong>{selectedCustomer.totalSpentIQD.toLocaleString('en-IQ')} IQD</strong>
                                </div>
                                <div className="CustomersPage-metricCard">
                                    <div className="CustomersPage-metricCard-label">
                                        <Calendar size={14} />
                                        <span>{t('visits') || 'Visits'}</span>
                                    </div>
                                    <strong>{selectedCustomer.totalVisits}</strong>
                                </div>
                                <div className="CustomersPage-metricCard CustomersPage-metricCard--points">
                                    <div className="CustomersPage-metricCard-label">
                                        <Award size={14} />
                                        <span>{t('loyaltyPoints') || 'Loyalty Points'}</span>
                                    </div>
                                    <strong>{selectedCustomer.loyaltyPoints.toFixed(1)}</strong>
                                </div>
                            </div>

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

            {/* New Customer Modal */}
            {modalOpen && (
                <div className="CustomersPage-modalOverlay" onClick={() => setModalOpen(false)}>
                    <div className="CustomersPage-modal" onClick={(e) => e.stopPropagation()}>
                        <header>
                            <h3>{t('newCustomer')}</h3>
                            <button onClick={() => setModalOpen(false)}>✕</button>
                        </header>
                        <form onSubmit={handleSubmit}>
                            <label>
                                <span>{t('name')}</span>
                                <input
                                    type="text"
                                    required
                                    value={formState.name}
                                    onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </label>
                            <label>
                                <span>{t('phone')}</span>
                                <input
                                    type="text"
                                    value={formState.phone ?? ''}
                                    onChange={(e) => setFormState(prev => ({ ...prev, phone: e.target.value }))}
                                />
                            </label>
                            <label className="CustomersPage-span">
                                <span>{t('notes')}</span>
                                <textarea
                                    rows={3}
                                    value={formState.notes ?? ''}
                                    onChange={(e) => setFormState(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </label>
                            <div className="CustomersPage-span" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button type="button" className="ghost" onClick={() => setModalOpen(false)} style={{ border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer', background: 'transparent', color: 'var(--text-primary)' }}>
                                    {t('cancel')}
                                </button>
                                <button type="submit" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: 'white', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', fontWeight: 600, cursor: 'pointer' }} disabled={submitting}>
                                    {submitting ? t('saving') : t('save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Voucher Modal */}
            {voucherModalOpen && (
                <div className="CustomersPage-modalOverlay" onClick={() => setVoucherModalOpen(false)}>
                    <div className="CustomersPage-modal" onClick={(e) => e.stopPropagation()}>
                        <header>
                            <h3>{t('createVoucher')}</h3>
                            <button onClick={() => setVoucherModalOpen(false)}>✕</button>
                        </header>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('searchCustomer') || 'Search Customer'}</span>
                                <input
                                    type="text"
                                    placeholder={t('searchByNameOrPhone')}
                                    value={voucherSearch}
                                    onChange={(e) => setVoucherSearch(e.target.value)}
                                    style={{ borderRadius: '0.5rem', border: '1px solid var(--border-color)', padding: '0.6rem 0.85rem', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                                />
                            </label>

                            {voucherSearch && (
                                <div style={{ border: '1px solid var(--border-color)', borderRadius: '0.5rem', maxHeight: '120px', overflowY: 'auto', background: 'var(--bg-input)' }}>
                                    {customers
                                        .filter(c => c.name.toLowerCase().includes(voucherSearch.toLowerCase()) || c.phone?.includes(voucherSearch))
                                        .map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => {
                                                    setVoucherCustomerId(c.id);
                                                    setVoucherSearch('');
                                                }}
                                                style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}
                                            >
                                                <span>{c.name}</span>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{c.phone}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}

                            {voucherCustomerId && (
                                <div style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '0.5rem', padding: '0.6rem 0.85rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{t('selected')}: <strong>{customers.find(c => c.id === voucherCustomerId)?.name}</strong></span>
                                    <button onClick={() => setVoucherCustomerId('')} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.78rem' }}>{t('clear')}</button>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('discountPercent')}</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={voucherDiscount}
                                        onChange={(e) => setVoucherDiscount(Number(e.target.value))}
                                        style={{ borderRadius: '0.5rem', border: '1px solid var(--border-color)', padding: '0.6rem 0.85rem', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                                    />
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('validityDays')}</span>
                                    <input
                                        type="number"
                                        min="1"
                                        value={voucherValidityDays}
                                        onChange={(e) => setVoucherValidityDays(Number(e.target.value))}
                                        style={{ borderRadius: '0.5rem', border: '1px solid var(--border-color)', padding: '0.6rem 0.85rem', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                                    />
                                </label>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button type="button" style={{ border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer', background: 'transparent', color: 'var(--text-primary)' }} onClick={() => setVoucherModalOpen(false)}>
                                    {t('cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const c = customers.find(cust => cust.id === voucherCustomerId);
                                        const html = generateVoucherHtml(voucherDiscount, voucherValidityDays, c?.name);
                                        if (window.evaApi) {
                                            try {
                                                await window.evaApi.printHtml(html, preferredPrinter);
                                                setVoucherModalOpen(false);
                                            } catch (err) {
                                                console.error('Failed to print voucher', err);
                                                setError(t('failedToPrintReport'));
                                            }
                                        }
                                    }}
                                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: 'white', borderRadius: '0.5rem', padding: '0.5rem 1.25rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                    <Printer size={16} />
                                    <span>{t('printVoucher')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomersPage;
