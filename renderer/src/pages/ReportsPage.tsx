import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { utils, writeFile } from 'xlsx';
import './Pages.css';
import './ReportsPage.css';

const defaultStart = new Date();
defaultStart.setDate(defaultStart.getDate() - 7);

const formatDateInput = (date: Date): string => date.toISOString().slice(0, 10);

type AdvancedReports = import('../types/electron').AdvancedReports;

const ReportsPage = (): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [range, setRange] = useState({
    startDate: formatDateInput(defaultStart),
    endDate: formatDateInput(new Date()),
  });
  const [reports, setReports] = useState<AdvancedReports | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async () => {
    if (!window.evaApi || !token) {
      setError('Desktop bridge unavailable.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await window.evaApi.reports.advanced(token, range);
      setReports(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadReports'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadReports();
    }
  }, [token]);

  const exportToExcel = () => {
    if (!reports) return;
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(reports.dailySales), 'Daily Sales');
    utils.book_append_sheet(wb, utils.json_to_sheet(reports.bestSellingItems), 'Best Sellers');
    utils.book_append_sheet(wb, utils.json_to_sheet(reports.salesBySize), 'Sales by Size');
    utils.book_append_sheet(wb, utils.json_to_sheet(reports.salesByColor), 'Sales by Color');
    utils.book_append_sheet(wb, utils.json_to_sheet(reports.topCustomers), 'Top Customers');
    utils.book_append_sheet(
      wb,
      utils.json_to_sheet([
        {
          revenueIQD: reports.profitAnalysis.revenueIQD,
          costIQD: reports.profitAnalysis.costIQD,
          expensesIQD: reports.profitAnalysis.expensesIQD,
          netProfitIQD: reports.profitAnalysis.netProfitIQD,
        },
      ]),
      'Profit',
    );
    utils.book_append_sheet(wb, utils.json_to_sheet(reports.lowStock), 'Low Stock');
    utils.book_append_sheet(wb, utils.json_to_sheet(reports.expensesVsSales), 'Expenses vs Sales');
    utils.book_append_sheet(wb, utils.json_to_sheet(reports.activityLogs), 'Activity Logs');
    writeFile(wb, `reports_${range.startDate}_${range.endDate}.xlsx`);
  };

  const printReport = async () => {
    if (!reports || !window.evaApi) return;

    // Generate formatted HTML report
    const reportHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>EVA POS - Advanced Reports</title>
  <style>
    @media print {
      @page { margin: 1cm; }
      body { margin: 0; }
    }
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      color: #333;
    }
    h1 {
      text-align: center;
      color: #2c3e50;
      border-bottom: 3px solid #3498db;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    .report-header {
      text-align: center;
      margin-bottom: 30px;
      color: #7f8c8d;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #ecf0f1;
      padding: 15px;
      border-radius: 5px;
      text-align: center;
    }
    .stat-label {
      font-size: 12px;
      color: #7f8c8d;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 20px;
      font-weight: bold;
      color: #2c3e50;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    table th {
      background: #34495e;
      color: white;
      padding: 10px;
      text-align: left;
      font-weight: bold;
    }
    table td {
      padding: 8px 10px;
      border-bottom: 1px solid #ddd;
    }
    table tr:nth-child(even) {
      background: #f9f9f9;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      margin: 30px 0 15px 0;
      color: #2c3e50;
      border-left: 4px solid #3498db;
      padding-left: 10px;
    }
    .empty-message {
      text-align: center;
      color: #95a5a6;
      padding: 20px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>EVA POS - Advanced Reports</h1>
  <div class="report-header">
    <p><strong>Report Period:</strong> ${range.startDate} to ${range.endDate}</p>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Revenue</div>
      <div class="stat-value">${reports.profitAnalysis.revenueIQD.toLocaleString('en-IQ')} IQD</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Cost of Goods</div>
      <div class="stat-value">${reports.profitAnalysis.costIQD.toLocaleString('en-IQ')} IQD</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Expenses</div>
      <div class="stat-value">${reports.profitAnalysis.expensesIQD.toLocaleString('en-IQ')} IQD</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Net Profit</div>
      <div class="stat-value">${reports.profitAnalysis.netProfitIQD.toLocaleString('en-IQ')} IQD</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Inventory Value</div>
      <div class="stat-value">${reports.inventoryValue.toLocaleString('en-IQ')} IQD</div>
    </div>
  </div>

  <div class="section-title">Daily Sales Summary</div>
  ${reports.dailySales.length === 0 ? '<div class="empty-message">No sales in this range.</div>' : `
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Orders</th>
        <th>Total (IQD)</th>
        <th>Avg Ticket (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${reports.dailySales.map(entry => `
        <tr>
          <td>${entry.date}</td>
          <td>${entry.orders}</td>
          <td>${entry.totalIQD.toLocaleString('en-IQ')}</td>
          <td>${entry.avgTicket.toLocaleString('en-IQ')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  `}

  <div class="section-title">Best Selling Items</div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Quantity</th>
        <th>Sales (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${reports.bestSellingItems.map(item => `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.amountIQD.toLocaleString('en-IQ')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="section-title">Sales by Size</div>
  <table>
    <thead>
      <tr>
        <th>Size</th>
        <th>Quantity</th>
        <th>Sales (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${reports.salesBySize.map(item => `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.amountIQD.toLocaleString('en-IQ')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="section-title">Sales by Color</div>
  <table>
    <thead>
      <tr>
        <th>Color</th>
        <th>Quantity</th>
        <th>Sales (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${reports.salesByColor.map(item => `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.amountIQD.toLocaleString('en-IQ')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="section-title">Top Customers</div>
  <table>
    <thead>
      <tr>
        <th>Customer</th>
        <th>Orders</th>
        <th>Spend (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${reports.topCustomers.map(entry => `
        <tr>
          <td>${entry.name}</td>
          <td>${entry.quantity}</td>
          <td>${entry.amountIQD.toLocaleString('en-IQ')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${reports.lowStock.length > 0 ? `
  <div class="section-title">Low Stock Alerts</div>
  <table>
    <thead>
      <tr>
        <th>SKU</th>
        <th>Product</th>
        <th>Variant</th>
        <th>Quantity</th>
      </tr>
    </thead>
    <tbody>
      ${reports.lowStock.map(entry => `
        <tr>
          <td>${entry.sku}</td>
          <td>${entry.productName}</td>
          <td>${entry.color ?? 'Any'} / ${entry.size ?? 'Any'}</td>
          <td>${entry.quantity}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="section-title">Expenses vs Sales</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Sales (IQD)</th>
        <th>Expenses (IQD)</th>
      </tr>
    </thead>
    <tbody>
      ${reports.expensesVsSales.map(entry => `
        <tr>
          <td>${entry.date}</td>
          <td>${entry.salesIQD.toLocaleString('en-IQ')}</td>
          <td>${entry.expensesIQD.toLocaleString('en-IQ')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="section-title">Activity Logs</div>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>User</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      ${reports.activityLogs.map(log => `
        <tr>
          <td>${new Date(log.createdAt).toLocaleString()}</td>
          <td>${log.userId}</td>
          <td>${log.action} ${log.entity ? `(${log.entity} #${log.entityId ?? ''})` : ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>
    `;

    try {
      await window.evaApi.printing.print({ html: reportHtml, printerName: null });
    } catch (error) {
      alert(`${t('failedToPrintReport')}: ${error instanceof Error ? error.message : t('unknownError')}`);
    }
  };

  return (
    <div className="Page Page--transparent Reports">
      <div className="Reports-header">
        <div>
          <h1>{t('advancedReports')}</h1>
          <p>{t('endToEndInsight')}</p>
        </div>
        <div className="Reports-actions">
          <button onClick={exportToExcel} disabled={!reports}>
            {t('exportToExcel')}
          </button>
          <button onClick={printReport}>{t('print')}</button>
        </div>
      </div>

      <section className="Reports-quickFilters">
        <button onClick={() => {
          const today = new Date();
          setRange({ startDate: formatDateInput(today), endDate: formatDateInput(today) });
        }}>{t('today')}</button>
        <button onClick={() => {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          setRange({ startDate: formatDateInput(yesterday), endDate: formatDateInput(yesterday) });
        }}>{t('yesterday')}</button>
        <button onClick={() => {
          const today = new Date();
          const start = new Date();
          start.setDate(today.getDate() - 6);
          setRange({ startDate: formatDateInput(start), endDate: formatDateInput(today) });
        }}>{t('last7days')}</button>
        <button onClick={() => {
          const today = new Date();
          const start = new Date();
          start.setDate(today.getDate() - 29);
          setRange({ startDate: formatDateInput(start), endDate: formatDateInput(today) });
        }}>{t('last30days')}</button>
        <button onClick={() => {
          const today = new Date();
          const start = new Date(today.getFullYear(), today.getMonth(), 1);
          setRange({ startDate: formatDateInput(start), endDate: formatDateInput(today) });
        }}>{t('thisMonth')}</button>
        <button onClick={() => {
          const today = new Date();
          const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const end = new Date(today.getFullYear(), today.getMonth(), 0);
          setRange({ startDate: formatDateInput(start), endDate: formatDateInput(end) });
        }}>{t('lastMonth')}</button>
      </section>

      <section className="Reports-filters">
        <label>
          {t('startDate')}
          <input
            type="date"
            value={range.startDate}
            onChange={(event) => setRange((prev) => ({ ...prev, startDate: event.target.value }))}
          />
        </label>
        <label>
          {t('endDate')}
          <input
            type="date"
            value={range.endDate}
            onChange={(event) => setRange((prev) => ({ ...prev, endDate: event.target.value }))}
          />
        </label>
        <button className="Reports-button" onClick={loadReports} disabled={loading}>
          {loading ? t('loading') : t('runReport')}
        </button>
      </section>

      {error && <div className="Reports-alert Reports-alert--error">{error}</div>}

      {!reports ? (
        <div className="Reports-empty">{t('runReportToSeeData')}</div>
      ) : (
        <>
          <section className="Reports-stats">
            <div>
              <span>{t('revenueIQD')}</span>
              <strong>{reports.profitAnalysis.revenueIQD.toLocaleString('en-IQ')}</strong>
            </div>
            <div>
              <span>{t('costOfGoods')}</span>
              <strong>{reports.profitAnalysis.costIQD.toLocaleString('en-IQ')}</strong>
            </div>
            <div>
              <span>{t('expenses')}</span>
              <strong>{reports.profitAnalysis.expensesIQD.toLocaleString('en-IQ')}</strong>
            </div>
            <div className={reports.profitAnalysis.netProfitIQD >= 0 ? 'Reports-stat--positive' : 'Reports-stat--negative'}>
              <span>{t('netProfit')}</span>
              <strong>{reports.profitAnalysis.netProfitIQD.toLocaleString('en-IQ')}</strong>
              <small className="Reports-margin">({reports.profitAnalysis.profitMarginPercent}%)</small>
            </div>
            <div>
              <span>{t('inventoryValue')}</span>
              <strong>{reports.inventoryValue.toLocaleString('en-IQ')}</strong>
            </div>
            <div>
              <span>{t('returns')}</span>
              <strong>{reports.returnsSummary.totalIQD.toLocaleString('en-IQ')}</strong>
              <small>({reports.returnsSummary.count} {t('items')})</small>
            </div>
          </section>

          <section className="Reports-grid">
            <article>
              <header>
                <h3>{t('dailySalesSummary')}</h3>
              </header>
              {reports.dailySales.length === 0 ? (
                <div className="Reports-empty">{t('noSalesInRange')}</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{t('date')}</th>
                      <th>{t('ordersReport')}</th>
                      <th>{t('totalReport')}</th>
                      <th>{t('avgTicket')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.dailySales.map((entry) => (
                      <tr key={entry.date}>
                        <td>{entry.date}</td>
                        <td>{entry.orders}</td>
                        <td>{entry.totalIQD.toLocaleString('en-IQ')}</td>
                        <td>{entry.avgTicket.toLocaleString('en-IQ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>

            <article>
              <header>
                <h3>{t('bestSellingItems')}</h3>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>{t('item')}</th>
                    <th>{t('qty')}</th>
                    <th>{t('salesIQD')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.bestSellingItems.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.amountIQD.toLocaleString('en-IQ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article>
              <header>
                <h3>{t('salesBySize')}</h3>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>{t('size')}</th>
                    <th>{t('qty')}</th>
                    <th>{t('salesReport')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.salesBySize.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.amountIQD.toLocaleString('en-IQ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article>
              <header>
                <h3>{t('salesByColor')}</h3>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>{t('colorReport')}</th>
                    <th>{t('qty')}</th>
                    <th>{t('salesReport')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.salesByColor.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.amountIQD.toLocaleString('en-IQ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article>
              <header>
                <h3>{t('topCustomers')}</h3>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>{t('customer')}</th>
                    <th>{t('ordersReport')}</th>
                    <th>{t('spend')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.topCustomers.map((entry) => (
                    <tr key={entry.name}>
                      <td>{entry.name}</td>
                      <td>{entry.quantity}</td>
                      <td>{entry.amountIQD.toLocaleString('en-IQ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article>
              <header>
                <h3>{t('lowStockAlerts')}</h3>
              </header>
              {reports.lowStock.length === 0 ? (
                <div className="Reports-empty">{t('stockLevelsHealthy')}</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{t('skuReport')}</th>
                      <th>{t('product')}</th>
                      <th>{t('variant')}</th>
                      <th>{t('qty')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.lowStock.map((entry) => (
                      <tr key={entry.sku}>
                        <td>{entry.sku}</td>
                        <td>{entry.productName}</td>
                        <td>
                          {entry.color ?? t('any')} / {entry.size ?? t('any')}
                        </td>
                        <td>{entry.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>

            <article>
              <header>
                <h3>{t('expensesVsSales')}</h3>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>{t('date')}</th>
                    <th>{t('salesReport')}</th>
                    <th>{t('expensesReport')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.expensesVsSales.map((entry) => (
                    <tr key={entry.date}>
                      <td>{entry.date}</td>
                      <td>{entry.salesIQD.toLocaleString('en-IQ')}</td>
                      <td>{entry.expensesIQD.toLocaleString('en-IQ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article>
              <header>
                <h3>{t('activityLogs')}</h3>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>{t('time')}</th>
                    <th>{t('user')}</th>
                    <th>{t('action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.activityLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td>{log.userId}</td>
                      <td>
                        {log.action} {log.entity ? `(${log.entity} #${log.entityId ?? ''})` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article>
              <header>
                <h3>{t('inventoryBySupplier')}</h3>
              </header>
              {reports.inventoryBySupplier && reports.inventoryBySupplier.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>{t('supplier')}</th>
                      <th>{t('quantity')}</th>
                      <th>{t('valueUSD')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.inventoryBySupplier.map((item) => (
                      <tr key={item.supplierName}>
                        <td>{item.supplierName === 'No Supplier' ? t('noSupplierAssigned') : item.supplierName}</td>
                        <td>{item.totalQuantity.toLocaleString('en-IQ')}</td>
                        <td>${item.totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="Reports-empty">{t('noData')}</div>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  );
};

export default ReportsPage;

