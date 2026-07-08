import React, { useState } from 'react';
import { Users, Loader2, X, ShoppingBag } from 'lucide-react';
import type { EmployeeDetailedSalesEntry } from '../../types/electron';
import { useLanguage } from '../../contexts/LanguageContext';

interface EmployeeSalesEntry {
  employeeId: number | null;
  employeeName: string;
  salesCount: number;
  itemsSold: number;
  totalRevenueIQD: number;
}

interface Props {
  employeeSales: EmployeeSalesEntry[];
  startDate: string;
  endDate: string;
  token: string | null;
}

interface GroupedSale {
  saleId: number;
  saleDate: string;
  items: EmployeeDetailedSalesEntry[];
  subtotalIQD: number;
  discountIQD: number;
  totalIQD: number;
}

const fmt = (n: number) => n.toLocaleString('en-IQ');

// Custom date formatter that yields YYYY-MM-DD in Western numerals
const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 10);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  } catch {
    return dateStr.slice(0, 10);
  }
};

// Groups detailed sales entries by transaction (saleId)
const groupSalesByTransaction = (entries: EmployeeDetailedSalesEntry[]): GroupedSale[] => {
  const groups: Record<number, GroupedSale> = {};
  
  entries.forEach(entry => {
    if (!groups[entry.saleId]) {
      groups[entry.saleId] = {
        saleId: entry.saleId,
        saleDate: entry.saleDate,
        items: [],
        subtotalIQD: entry.subtotalIQD,
        discountIQD: entry.discountIQD,
        totalIQD: entry.totalIQD
      };
    }
    groups[entry.saleId].items.push(entry);
  });
  
  return Object.values(groups).sort((a, b) => b.saleId - a.saleId);
};

export const EmployeesTab = ({ employeeSales, startDate, endDate, token }: Props): JSX.Element => {
  const { t, isRTL } = useLanguage();

  const totalRevenue = employeeSales.reduce((s, c) => s + c.totalRevenueIQD, 0);
  const totalSalesCount = employeeSales.reduce((s, c) => s + c.salesCount, 0);
  const totalItemsSold = employeeSales.reduce((s, c) => s + c.itemsSold, 0);

  // Modal State
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSalesEntry | null>(null);
  const [detailedSales, setDetailedSales] = useState<EmployeeDetailedSalesEntry[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const handleRowClick = async (entry: EmployeeSalesEntry) => {
    setSelectedEmployee(entry);
    setLoadingDetails(true);
    setErrorDetails(null);
    setDetailedSales([]);

    if (!window.evaApi || !token) {
      setErrorDetails('Desktop API is unavailable.');
      setLoadingDetails(false);
      return;
    }

    try {
      const data = await window.evaApi.employees.detailedSalesReport(token, {
        employeeId: entry.employeeId,
        startDate,
        endDate,
      });
      setDetailedSales(data || []);
    } catch (err) {
      console.error(err);
      setErrorDetails('Failed to load detailed sales.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const groupedSales = groupSalesByTransaction(detailedSales);

  return (
    <>
      {/* Mini KPIs */}
      <div className="Reports-miniKpis">
        <div className="Reports-miniKpi">
          <span>{t('employees') || 'Employees'}</span>
          <strong>{employeeSales.length}</strong>
        </div>
        <div className="Reports-miniKpi">
          <span>{t('totalRevenue') || 'Total Revenue'}</span>
          <strong>{fmt(totalRevenue)} IQD</strong>
        </div>
        <div className="Reports-miniKpi">
          <span>{t('totalItemsSold') || 'Total Items Sold'}</span>
          <strong>{fmt(totalItemsSold)}</strong>
        </div>
      </div>

      {/* Employee Sales Table */}
      <section className="Reports-grid">
        <article className="Reports-fullWidth" style={{ maxHeight: 500 }}>
          <header>
            <h3>
              <Users size={18} /> {t('employeeSales') || 'Sales by Employee'}
            </h3>
          </header>
          {employeeSales.length === 0 ? (
            <div className="Reports-empty">{t('noData')}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('employeeName') || 'Employee Name'}</th>
                  <th>{t('salesReport') || 'Sales Count'}</th>
                  <th>{t('totalItemsSold') || 'Items Sold'}</th>
                  <th>{t('totalAmount') || 'Revenue'}</th>
                  <th>{t('share') || '% Share'}</th>
                </tr>
              </thead>
              <tbody>
                {employeeSales.map((entry, idx) => {
                  const share =
                    totalRevenue > 0
                      ? ((entry.totalRevenueIQD / totalRevenue) * 100).toFixed(1)
                      : '0';
                  return (
                    <tr 
                      key={entry.employeeId || 'unassigned'}
                      onClick={() => handleRowClick(entry)}
                      style={{ cursor: 'pointer' }}
                      title={t('clickToSeeDetails') || 'Click to view sold products'}
                    >
                      <td>{idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`}</td>
                      <td>
                        <span style={{ color: 'var(--text-link)', textDecoration: 'underline', fontWeight: 600 }}>
                          {entry.employeeName}
                        </span>
                      </td>
                      <td>{entry.salesCount}</td>
                      <td>{entry.itemsSold}</td>
                      <td>{fmt(entry.totalRevenueIQD)} IQD</td>
                      <td>{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </article>
      </section>

      {/* Detailed Sales Modal */}
      {selectedEmployee && (
        <div className="Reports-modalOverlay" onClick={() => setSelectedEmployee(null)}>
          <div className={`Reports-modal ${isRTL ? 'Reports-modal--rtl' : ''}`} onClick={(e) => e.stopPropagation()}>
            <header className="Reports-modalHeader">
              <div>
                <h3>
                  <ShoppingBag size={18} /> {selectedEmployee.employeeName} — {t('detailedSales') || 'Detailed Sales'}
                </h3>
                <p>
                  {startDate} {t('to') || 'to'} {endDate}
                </p>
              </div>
              <button className="Reports-modalClose" onClick={() => setSelectedEmployee(null)}>
                <X size={18} />
              </button>
            </header>

            <div className="Reports-modalContent">
              {loadingDetails ? (
                <div className="Reports-loader">
                  <Loader2 size={32} className="spin" />
                  <span>{t('loadingDetails') || 'Loading sold items...'}</span>
                </div>
              ) : errorDetails ? (
                <div className="Reports-alert Reports-alert--error">{errorDetails}</div>
              ) : groupedSales.length === 0 ? (
                <div className="Reports-empty">{t('noSoldItems') || 'No items sold during this period.'}</div>
              ) : (
                <div>
                  {groupedSales.map((sale) => (
                    <div key={sale.saleId} className="Reports-transactionCard">
                      <header className="Reports-transactionHeader">
                        <div className="Reports-transactionHeader-left">
                          <span className="Reports-transactionId">#{sale.saleId}</span>
                          <span className="Reports-transactionDate">{formatDate(sale.saleDate)}</span>
                        </div>
                        <div className="Reports-transactionTotal">
                          {sale.discountIQD > 0 && (
                            <>
                              <span className="Reports-subtotalText">
                                {t('subtotal') || 'Subtotal'}: {fmt(sale.subtotalIQD)} IQD
                              </span>
                              <span className="Reports-discountText">
                                {t('discount') || 'Discount'}: -{fmt(sale.discountIQD)} IQD
                              </span>
                            </>
                          )}
                          <span>{t('total') || 'Total'}:</span>
                          <strong>{fmt(sale.totalIQD)} IQD</strong>
                        </div>
                      </header>
                      <div className="Reports-transactionBody" style={{ overflowX: 'auto' }}>
                        <table className="Reports-detailedTable">
                          <thead>
                            <tr>
                              <th style={{ width: '60%' }}>{t('product') || 'Product'}</th>
                              <th style={{ width: '15%' }}>{t('unitPrice') || 'Unit Price'}</th>
                              <th style={{ width: '10%', textAlign: 'center' }}>{t('qty') || 'Qty'}</th>
                              <th style={{ width: '15%', textAlign: 'end' }}>{t('lineTotal') || 'Total'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sale.items.map((item, idx) => {
                              const variantStr = [item.color, item.size].filter(Boolean).join(' / ') || '—';
                              return (
                                <tr key={idx}>
                                  <td>
                                    <strong>{item.productName}</strong>
                                    {variantStr !== '—' && (
                                      <span className="Reports-variantBadge" style={{ marginInlineStart: '0.5rem' }}>
                                        {variantStr}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>{fmt(item.unitPriceIQD)} IQD</td>
                                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                                  <td style={{ textAlign: 'end', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                    {item.quantity > 1 ? (
                                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                        {item.quantity} × {fmt(item.unitPriceIQD)}
                                      </span>
                                    ) : null}
                                    <span>{fmt(item.lineTotalIQD)} IQD</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="Reports-modalFooter">
              <div className="Reports-modalFooter-info">
                <div className="Reports-modalFooter-pill">
                  <span>{t('totalItemsSold') || 'Total Items Sold'}:</span>
                  <strong>{fmt(detailedSales.reduce((sum, item) => sum + item.quantity, 0))}</strong>
                </div>
                <div className="Reports-modalFooter-pill">
                  <span>{t('totalRevenue') || 'Total Revenue'}:</span>
                  <strong style={{ color: '#10b981' }}>{fmt(detailedSales.reduce((sum, item) => sum + item.lineTotalIQD, 0))} IQD</strong>
                </div>
              </div>
              <button className="Reports-btnSecondary" onClick={() => setSelectedEmployee(null)}>
                {t('close') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
