import React, { useState } from 'react';
import { Users, Loader2, X, ShoppingBag } from 'lucide-react';
import type { EmployeeDetailedSalesEntry } from '../../types/electron';

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
  t: (key: string) => string;
}

const fmt = (n: number) => n.toLocaleString('en-IQ');

export const EmployeesTab = ({ employeeSales, startDate, endDate, token, t }: Props): JSX.Element => {
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
          <div className="Reports-modal" onClick={(e) => e.stopPropagation()}>
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
              ) : detailedSales.length === 0 ? (
                <div className="Reports-empty">{t('noSoldItems') || 'No items sold during this period.'}</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{t('date') || 'Date'}</th>
                      <th>{t('product') || 'Product'}</th>
                      <th>{t('variant') || 'Variant'}</th>
                      <th>{t('skuReport') || 'SKU'}</th>
                      <th>{t('qty') || 'Qty'}</th>
                      <th>{t('unitPrice') || 'Unit Price'}</th>
                      <th>{t('lineTotal') || 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedSales.map((item, idx) => {
                      const variantStr = [item.color, item.size].filter(Boolean).join(' / ') || '—';
                      return (
                        <tr key={idx}>
                          <td>{new Date(item.saleDate).toLocaleDateString()}</td>
                          <td><strong>{item.productName}</strong></td>
                          <td>{variantStr}</td>
                          <td><code>{item.sku}</code></td>
                          <td>{item.quantity}</td>
                          <td>{fmt(item.unitPriceIQD)} IQD</td>
                          <td><strong>{fmt(item.lineTotalIQD)} IQD</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="Reports-modalFooter">
              <div className="Reports-modalFooter-info">
                <span>
                  {t('totalItemsSold') || 'Total Items Sold'}: <strong>{fmt(detailedSales.reduce((sum, item) => sum + item.quantity, 0))}</strong>
                </span>
                <span>
                  {t('totalRevenue') || 'Total Revenue'}: <strong>{fmt(detailedSales.reduce((sum, item) => sum + item.lineTotalIQD, 0))} IQD</strong>
                </span>
              </div>
              <button className="Users-cancel" onClick={() => setSelectedEmployee(null)}>
                {t('close') || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
