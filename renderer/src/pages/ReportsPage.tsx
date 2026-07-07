import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { utils, writeFile } from 'xlsx';
import {
  FileDown, Printer, Play, Calendar, History, BarChart, BarChart2,
  CalendarDays, CalendarRange, Loader2, Database,
  LayoutDashboard, TrendingUp, Package, DollarSign, Users, ClipboardList
} from 'lucide-react';
import './Pages.css';
import './ReportsPage.css';

import { OverviewTab } from './reports/OverviewTab';
import { SalesTab } from './reports/SalesTab';
import { InventoryTab } from './reports/InventoryTab';
import { FinancialTab } from './reports/FinancialTab';
import { CustomersTab } from './reports/CustomersTab';
import { ActivityTab } from './reports/ActivityTab';
import { MonthlyTab } from './reports/MonthlyTab';
import { EmployeesTab } from './reports/EmployeesTab';

type AdvancedReports = import('../types/electron').AdvancedReports;
type LeastProfitableItem = import('../types/electron').LeastProfitableItem;
type LeastProfitableSupplier = import('../types/electron').LeastProfitableSupplier;
type InventoryAgingItem = import('../types/electron').InventoryAgingItem;
type PeakHourData = import('../types/electron').PeakHourData;
type PeakDayData = import('../types/electron').PeakDayData;
type ExpenseByCategoryItem = import('../types/electron').ExpenseByCategoryItem;
type SeasonSalesItem = import('../types/electron').SeasonSalesItem;

type TabId = 'overview' | 'sales' | 'monthly' | 'inventory' | 'financial' | 'customers' | 'activity' | 'employees';

const defaultStart = new Date();
defaultStart.setDate(defaultStart.getDate() - 7);
const formatDateInput = (date: Date): string => date.toISOString().slice(0, 10);

const TABS: { id: TabId; icon: typeof LayoutDashboard; labelKey: string }[] = [
  { id: 'overview', icon: LayoutDashboard, labelKey: 'overview' },
  { id: 'sales', icon: TrendingUp, labelKey: 'salesAnalysis' },
  { id: 'monthly', icon: CalendarDays, labelKey: 'monthlyAnalysis' },
  { id: 'inventory', icon: Package, labelKey: 'inventoryHealth' },
  { id: 'financial', icon: DollarSign, labelKey: 'financial' },
  { id: 'customers', icon: Users, labelKey: 'customers' },
  { id: 'employees', icon: Users, labelKey: 'employees' },
  { id: 'activity', icon: ClipboardList, labelKey: 'activityLogs' },
];

const ReportsPage = (): JSX.Element => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [range, setRange] = useState({
    startDate: formatDateInput(defaultStart),
    endDate: formatDateInput(new Date()),
    season: '',
  });
  const [reports, setReports] = useState<AdvancedReports | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leastProfitableItems, setLeastProfitableItems] = useState<LeastProfitableItem[]>([]);
  const [leastProfitableSuppliers, setLeastProfitableSuppliers] = useState<LeastProfitableSupplier[]>([]);
  const [inventoryAging, setInventoryAging] = useState<InventoryAgingItem[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHourData[]>([]);
  const [peakDays, setPeakDays] = useState<PeakDayData[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseByCategoryItem[]>([]);
  const [seasonSales, setSeasonSales] = useState<SeasonSalesItem[]>([]);
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([]);
  const [employeeSales, setEmployeeSales] = useState<any[]>([]);

  const loadReports = async () => {
    if (!window.evaApi || !token) {
      setError('Desktop bridge unavailable.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [response, leastItems, leastSuppliers, aging, hours, days, expCat, seasSales, empSales] = await Promise.all([
        window.evaApi.reports.advanced(token, { ...range, season: range.season || null }),
        window.evaApi.reports.leastProfitableItems(token, { startDate: range.startDate, endDate: range.endDate, season: range.season || null }),
        window.evaApi.reports.leastProfitableSuppliers(token, { startDate: range.startDate, endDate: range.endDate, season: range.season || null }),
        window.evaApi.reports.inventoryAging(token, { limit: 50, season: range.season || null }),
        window.evaApi.reports.peakHours(token, { startDate: range.startDate, endDate: range.endDate }),
        window.evaApi.reports.peakDays(token, { startDate: range.startDate, endDate: range.endDate }),
        window.evaApi.reports.expensesByCategory(token, { startDate: range.startDate, endDate: range.endDate }),
        window.evaApi.reports.salesBySeason(token, { startDate: range.startDate, endDate: range.endDate }),
        window.evaApi.employees?.salesReport
          ? window.evaApi.employees.salesReport(token, { startDate: range.startDate, endDate: range.endDate })
          : Promise.resolve([]),
      ]);
      setReports(response);
      setLeastProfitableItems(leastItems);
      setLeastProfitableSuppliers(leastSuppliers);
      setInventoryAging(aging);
      setPeakHours(hours);
      setPeakDays(days);
      setExpensesByCategory(expCat);
      setSeasonSales(seasSales);
      setEmployeeSales(empSales || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadReports'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadReports();
      if (window.evaApi?.products?.getSeasons) {
        window.evaApi.products.getSeasons(token).then(setAvailableSeasons).catch(console.error);
      }
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
    utils.book_append_sheet(wb, utils.json_to_sheet([{
      revenueIQD: reports.profitAnalysis.revenueIQD,
      costIQD: reports.profitAnalysis.costIQD,
      expensesIQD: reports.profitAnalysis.expensesIQD,
      netProfitIQD: reports.profitAnalysis.netProfitIQD,
    }]), 'Profit');
    utils.book_append_sheet(wb, utils.json_to_sheet(reports.lowStock), 'Low Stock');
    utils.book_append_sheet(wb, utils.json_to_sheet(reports.expensesVsSales), 'Expenses vs Sales');
    utils.book_append_sheet(wb, utils.json_to_sheet(reports.activityLogs), 'Activity Logs');
    if (seasonSales.length > 0) {
      utils.book_append_sheet(wb, utils.json_to_sheet(seasonSales), 'Season Sales');
    }
    if (expensesByCategory.length > 0) {
      utils.book_append_sheet(wb, utils.json_to_sheet(expensesByCategory), 'Expenses by Category');
    }
    writeFile(wb, `reports_${range.startDate}_${range.endDate}.xlsx`);
  };

  const printReport = async () => {
    if (!reports || !window.evaApi) return;
    const pa = reports.profitAnalysis;
    const reportHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>EVA POS - Reports</title>
<style>@media print{@page{margin:1cm}body{margin:0}}body{font-family:Arial,sans-serif;padding:20px;color:#333}
h1{text-align:center;color:#2c3e50;border-bottom:3px solid #3498db;padding-bottom:10px;margin-bottom:30px}
.report-header{text-align:center;margin-bottom:30px;color:#7f8c8d}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:30px}
.stat-card{background:#ecf0f1;padding:15px;border-radius:5px;text-align:center}
.stat-label{font-size:12px;color:#7f8c8d;margin-bottom:5px}.stat-value{font-size:20px;font-weight:bold;color:#2c3e50}
table{width:100%;border-collapse:collapse;margin-bottom:30px;page-break-inside:avoid}
table th{background:#34495e;color:white;padding:10px;text-align:left;font-weight:bold}
table td{padding:8px 10px;border-bottom:1px solid #ddd}table tr:nth-child(even){background:#f9f9f9}
.section-title{font-size:18px;font-weight:bold;margin:30px 0 15px 0;color:#2c3e50;border-left:4px solid #3498db;padding-left:10px}</style>
</head><body><h1>EVA POS - Reports</h1>
<div class="report-header"><p><strong>Period:</strong> ${range.startDate} to ${range.endDate}</p>
<p><strong>Generated:</strong> ${new Date().toLocaleString()}</p></div>
<div class="stats-grid">
<div class="stat-card"><div class="stat-label">Revenue</div><div class="stat-value">${pa.revenueIQD.toLocaleString('en-IQ')} IQD</div></div>
<div class="stat-card"><div class="stat-label">Cost</div><div class="stat-value">${pa.costIQD.toLocaleString('en-IQ')} IQD</div></div>
<div class="stat-card"><div class="stat-label">Expenses</div><div class="stat-value">${pa.expensesIQD.toLocaleString('en-IQ')} IQD</div></div>
<div class="stat-card"><div class="stat-label">Net Profit</div><div class="stat-value">${pa.netProfitIQD.toLocaleString('en-IQ')} IQD</div></div>
</div>
<div class="section-title">Daily Sales</div>
<table><thead><tr><th>Date</th><th>Orders</th><th>Total (IQD)</th><th>Avg Ticket</th></tr></thead><tbody>
${reports.dailySales.map(e => `<tr><td>${e.date}</td><td>${e.orders}</td><td>${e.totalIQD.toLocaleString('en-IQ')}</td><td>${e.avgTicket.toLocaleString('en-IQ')}</td></tr>`).join('')}
</tbody></table>
<div class="section-title">Best Selling Items</div>
<table><thead><tr><th>Item</th><th>Qty</th><th>Sales (IQD)</th></tr></thead><tbody>
${reports.bestSellingItems.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.amountIQD.toLocaleString('en-IQ')}</td></tr>`).join('')}
</tbody></table>
</body></html>`;
    try {
      await window.evaApi.printing.print({ html: reportHtml, printerName: null });
    } catch (err) {
      alert(`${t('failedToPrintReport')}: ${err instanceof Error ? err.message : t('unknownError')}`);
    }
  };

  // Fallback labels for new tab keys
  const tFallback = (key: string): string => {
    const fb: Record<string, string> = {
      overview: 'نظرة عامة',
      salesAnalysis: 'تحليل المبيعات',
      monthlyAnalysis: 'تحليل شهري',
      inventoryHealth: 'حالة المخزون',
      financial: 'المالية',
      customers: 'العملاء',
    };
    const result = t(key);
    return result === key ? (fb[key] || key) : result;
  };

  return (
    <div className="Page Page--transparent Reports">
      {/* Header */}
      <div className="Reports-header">
        <div>
          <h1>{t('advancedReports')}</h1>
          <p>{t('endToEndInsight')}</p>
        </div>
        <div className="Reports-actions">
          <button onClick={exportToExcel} disabled={!reports}><FileDown size={18} /> {t('exportToExcel')}</button>
          <button onClick={printReport}><Printer size={18} /> {t('print')}</button>
        </div>
      </div>

      {/* Tab Bar */}
      <nav className="Reports-tabs">
        {TABS.map(({ id, icon: Icon, labelKey }) => (
          <button key={id} className={`Reports-tab ${activeTab === id ? 'Reports-tab--active' : ''}`} onClick={() => setActiveTab(id)}>
            <Icon size={16} /> {tFallback(labelKey)}
          </button>
        ))}
      </nav>

      {/* Quick Filters */}
      <section className="Reports-quickFilters">
        <button onClick={() => { const d = new Date(); setRange(p => ({ ...p, startDate: formatDateInput(d), endDate: formatDateInput(d) })); }}><Calendar size={14} /> {t('today')}</button>
        <button onClick={() => { const d = new Date(); d.setDate(d.getDate()-1); setRange(p => ({ ...p, startDate: formatDateInput(d), endDate: formatDateInput(d) })); }}><History size={14} /> {t('yesterday')}</button>
        <button onClick={() => { const e = new Date(); const s = new Date(); s.setDate(e.getDate()-6); setRange(p => ({ ...p, startDate: formatDateInput(s), endDate: formatDateInput(e) })); }}><BarChart size={14} /> {t('last7days')}</button>
        <button onClick={() => { const e = new Date(); const s = new Date(); s.setDate(e.getDate()-29); setRange(p => ({ ...p, startDate: formatDateInput(s), endDate: formatDateInput(e) })); }}><BarChart2 size={14} /> {t('last30days')}</button>
        <button onClick={() => { const e = new Date(); const s = new Date(e.getFullYear(), e.getMonth(), 1); setRange(p => ({ ...p, startDate: formatDateInput(s), endDate: formatDateInput(e) })); }}><CalendarDays size={14} /> {t('thisMonth')}</button>
        <button onClick={() => { const e = new Date(); const s = new Date(e.getFullYear(), e.getMonth()-1, 1); const end = new Date(e.getFullYear(), e.getMonth(), 0); setRange(p => ({ ...p, startDate: formatDateInput(s), endDate: formatDateInput(end) })); }}><CalendarRange size={14} /> {t('lastMonth')}</button>
        <button onClick={() => { const e = new Date(); setRange(p => ({ ...p, startDate: formatDateInput(new Date(2000,0,1)), endDate: formatDateInput(e) })); }}><Database size={14} /> {t('allTime')}</button>
      </section>

      {/* Date + Season Filters */}
      <section className="Reports-filters">
        <label>{t('startDate')}<input type="date" value={range.startDate} onChange={(e) => setRange(p => ({ ...p, startDate: e.target.value }))} /></label>
        <label>{t('endDate')}<input type="date" value={range.endDate} onChange={(e) => setRange(p => ({ ...p, endDate: e.target.value }))} /></label>
        <label>
          {t('season')}
          <select value={range.season} onChange={(e) => setRange(p => ({ ...p, season: e.target.value }))}>
            <option value="">{t('allSeasons')}</option>
            {availableSeasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <button className="Reports-button" onClick={loadReports} disabled={loading}>
          {loading ? <><Loader2 size={16} className="spin" /> {t('loading')}</> : <><Play size={16} /> {t('runReport')}</>}
        </button>
      </section>

      {error && <div className="Reports-alert Reports-alert--error">{error}</div>}

      {/* Tab Content */}
      {!reports ? (
        <div className="Reports-empty">{t('runReportToSeeData')}</div>
      ) : (
        <>
          {activeTab === 'overview' && <OverviewTab reports={reports} peakDays={peakDays} t={t} />}
          {activeTab === 'sales' && <SalesTab reports={reports} peakHours={peakHours} seasonSales={seasonSales} t={t} />}
          {activeTab === 'monthly' && <MonthlyTab reports={reports} expensesByCategory={expensesByCategory} t={t} />}
          {activeTab === 'inventory' && <InventoryTab reports={reports} leastProfitableItems={leastProfitableItems} leastProfitableSuppliers={leastProfitableSuppliers} inventoryAging={inventoryAging} t={t} />}
          {activeTab === 'financial' && <FinancialTab reports={reports} expensesByCategory={expensesByCategory} t={t} />}
          {activeTab === 'customers' && <CustomersTab reports={reports} t={t} />}
          {activeTab === 'employees' && <EmployeesTab employeeSales={employeeSales} t={t} />}
          {activeTab === 'activity' && <ActivityTab reports={reports} t={t} />}
        </>
      )}
    </div>
  );
};

export default ReportsPage;
