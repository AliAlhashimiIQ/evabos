import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { utils, writeFile } from 'xlsx';
import {
  FileDown, Printer, Play, Calendar, History, BarChart, BarChart2,
  CalendarDays, CalendarRange, Loader2, Database,
  LayoutDashboard, TrendingUp, Package, DollarSign, Users, ClipboardList, UserCog,
  ShoppingBag
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
import { OnlineOrdersTab } from './reports/OnlineOrdersTab';

type AdvancedReports = import('../types/electron').AdvancedReports;
type OnlineOrdersAnalytics = import('../types/electron').OnlineOrdersAnalytics;
type LeastProfitableItem = import('../types/electron').LeastProfitableItem;
type LeastProfitableSupplier = import('../types/electron').LeastProfitableSupplier;
type InventoryAgingItem = import('../types/electron').InventoryAgingItem;
type PeakHourData = import('../types/electron').PeakHourData;
type PeakDayData = import('../types/electron').PeakDayData;
type ExpenseByCategoryItem = import('../types/electron').ExpenseByCategoryItem;
type SeasonSalesItem = import('../types/electron').SeasonSalesItem;

type TabId = 'overview' | 'sales' | 'onlineOrders' | 'monthly' | 'inventory' | 'financial' | 'customers' | 'activity' | 'employees';

const defaultStart = new Date();
defaultStart.setDate(defaultStart.getDate() - 7);
const formatDateInput = (date: Date): string => date.toISOString().slice(0, 10);

const TABS: { id: TabId; icon: typeof LayoutDashboard; labelKey: string }[] = [
  { id: 'overview', icon: LayoutDashboard, labelKey: 'overview' },
  { id: 'sales', icon: TrendingUp, labelKey: 'salesAnalysis' },
  { id: 'onlineOrders', icon: ShoppingBag, labelKey: 'onlineOrdersReport' },
  { id: 'monthly', icon: CalendarDays, labelKey: 'monthlyAnalysis' },
  { id: 'inventory', icon: Package, labelKey: 'inventoryHealth' },
  { id: 'financial', icon: DollarSign, labelKey: 'financial' },
  { id: 'customers', icon: Users, labelKey: 'customers' },
  { id: 'employees', icon: UserCog, labelKey: 'employees' },
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
  const [onlineOrdersAnalytics, setOnlineOrdersAnalytics] = useState<OnlineOrdersAnalytics | null>(null);

  const loadReports = useCallback(async () => {
    if (!window.evaApi || !token) {
      setError('Desktop bridge unavailable.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [response, leastItems, leastSuppliers, aging, hours, days, expCat, seasSales, empSales, onlineAnalytics] = await Promise.all([
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
        window.evaApi.reports?.onlineOrders
          ? window.evaApi.reports.onlineOrders(token, { startDate: range.startDate, endDate: range.endDate })
          : Promise.resolve(null),
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
      setOnlineOrdersAnalytics(onlineAnalytics || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failedToLoadReports'));
    } finally {
      setLoading(false);
    }
  }, [token, range, t]);

  useEffect(() => {
    if (token) {
      loadReports();
      if (window.evaApi?.products?.getSeasons) {
        window.evaApi.products.getSeasons(token).then(setAvailableSeasons).catch(console.error);
      }
    }
  }, [token, loadReports]);

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
    if (onlineOrdersAnalytics && onlineOrdersAnalytics.summary.totalOrders > 0) {
      utils.book_append_sheet(wb, utils.json_to_sheet([onlineOrdersAnalytics.summary]), 'Online Orders KPIs');
      if (onlineOrdersAnalytics.bySource.length > 0) {
        utils.book_append_sheet(wb, utils.json_to_sheet(onlineOrdersAnalytics.bySource), 'Online by Channel');
      }
      if (onlineOrdersAnalytics.topProducts.length > 0) {
        utils.book_append_sheet(wb, utils.json_to_sheet(onlineOrdersAnalytics.topProducts), 'Online Top Products');
      }
      if (onlineOrdersAnalytics.topCustomers.length > 0) {
        utils.book_append_sheet(wb, utils.json_to_sheet(onlineOrdersAnalytics.topCustomers), 'Online Top Customers');
      }
    }
    writeFile(wb, `reports_${range.startDate}_${range.endDate}.xlsx`);
  };

  const printReport = async () => {
    if (!reports || !window.evaApi) return;
    const pa = reports.profitAnalysis;
    const reportHtml = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>مدار نقاط البيع - تقرير المبيعات</title>
<style>@media print{@page{margin:1cm}body{margin:0}}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:20px;color:#333;direction:rtl;text-align:right}
h1{text-align:center;color:#2c3e50;border-bottom:3px solid #3498db;padding-bottom:10px;margin-bottom:30px}
.report-header{text-align:center;margin-bottom:30px;color:#7f8c8d}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:30px}
.stat-card{background:#ecf0f1;padding:15px;border-radius:5px;text-align:center}
.stat-label{font-size:12px;color:#7f8c8d;margin-bottom:5px}.stat-value{font-size:20px;font-weight:bold;color:#2c3e50}
table{width:100%;border-collapse:collapse;margin-bottom:30px;page-break-inside:avoid;text-align:right}
table th{background:#34495e;color:white;padding:10px;text-align:right;font-weight:bold}
table td{padding:8px 10px;border-bottom:1px solid #ddd;text-align:right}table tr:nth-child(even){background:#f9f9f9}
.section-title{font-size:18px;font-weight:bold;margin:30px 0 15px 0;color:#2c3e50;border-right:4px solid #3498db;padding-right:10px}</style>
</head><body><h1>مدار نقاط البيع - تقرير المبيعات</h1>
<div class="report-header"><p><strong>الفترة:</strong> من ${range.startDate} إلى ${range.endDate}</p>
<p><strong>تاريخ وتوقيت الاستخراج:</strong> ${new Date().toLocaleString('ar-IQ')}</p></div>
<div class="stats-grid">
<div class="stat-card"><div class="stat-label">المبيعات الإجمالية</div><div class="stat-value">${pa.revenueIQD.toLocaleString('en-IQ')} د.ع</div></div>
<div class="stat-card"><div class="stat-label">التكلفة الإجمالية</div><div class="stat-value">${pa.costIQD.toLocaleString('en-IQ')} د.ع</div></div>
<div class="stat-card"><div class="stat-label">المصروفات</div><div class="stat-value">${pa.expensesIQD.toLocaleString('en-IQ')} د.ع</div></div>
<div class="stat-card"><div class="stat-label">صافي الربح</div><div class="stat-value">${pa.netProfitIQD.toLocaleString('en-IQ')} د.ع</div></div>
</div>
<div class="section-title">المبيعات اليومية</div>
<table><thead><tr><th>التاريخ</th><th>عدد الفواتير</th><th>المجموع (د.ع)</th><th>متوسط الفاتورة</th></tr></thead><tbody>
${reports.dailySales.map(e => `<tr><td>${e.date}</td><td>${e.orders}</td><td>${e.totalIQD.toLocaleString('en-IQ')}</td><td>${e.avgTicket.toLocaleString('en-IQ')}</td></tr>`).join('')}
</tbody></table>
<div class="section-title">المنتجات الأكثر مبيعاً</div>
<table><thead><tr><th>المنتج</th><th>الكمية المباعة</th><th>المبيعات (د.ع)</th></tr></thead><tbody>
${reports.bestSellingItems.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.amountIQD.toLocaleString('en-IQ')}</td></tr>`).join('')}
</tbody></table>
${(onlineOrdersAnalytics && onlineOrdersAnalytics.summary.totalOrders > 0) ? `
<div class="section-title">نظرة عامة على طلبات الأونلاين</div>
<div class="stats-grid">
  <div class="stat-card"><div class="stat-label">مبيعات الأونلاين المؤكدة</div><div class="stat-value">${onlineOrdersAnalytics.summary.totalRevenueIQD.toLocaleString('en-IQ')} د.ع</div></div>
  <div class="stat-card"><div class="stat-label">الطلبات المؤكدة</div><div class="stat-value">${onlineOrdersAnalytics.summary.confirmedOrders} (${onlineOrdersAnalytics.summary.confirmationRate}%)</div></div>
  <div class="stat-card"><div class="stat-label">متوسط قيمة الطلب</div><div class="stat-value">${onlineOrdersAnalytics.summary.avgOrderValueIQD.toLocaleString('en-IQ')} د.ع</div></div>
  <div class="stat-card"><div class="stat-label">القطع المباعة أونلاين</div><div class="stat-value">${onlineOrdersAnalytics.summary.totalItemsSold}</div></div>
</div>
<div class="section-title">مبيعات الأونلاين حسب القناة</div>
<table><thead><tr><th>القناة</th><th>إجمالي الطلبات</th><th>المؤكدة</th><th>الإيرادات (د.ع)</th><th>نسبة النجاح %</th></tr></thead><tbody>
${onlineOrdersAnalytics.bySource.map(s => `<tr><td>${s.source}</td><td>${s.totalOrders}</td><td>${s.confirmedOrders}</td><td>${s.revenueIQD.toLocaleString('en-IQ')}</td><td>${s.confirmationRate}%</td></tr>`).join('')}
</tbody></table>
` : ''}
<!-- Thermal Paper Feed Spacer (advances paper cleanly past cutter/tear bar and exit mouth) -->
<div style="height: 70mm; width: 100%; clear: both;"></div>
<div style="text-align: center; font-size: 10px; color: #000000; font-weight: bold; line-height: 1; clear: both;">.</div>
<div style="height: 15mm; width: 100%; clear: both;"></div>
</body></html>`;
    try {
      await window.evaApi.printing.print({ html: reportHtml, printerName: null });
    } catch (err) {
      alert(`${t('failedToPrintReport')}: ${err instanceof Error ? err.message : t('unknownError')}`);
    }
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
            <Icon size={16} /> {t(labelKey)}
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
          {activeTab === 'onlineOrders' && (
            <OnlineOrdersTab
              data={onlineOrdersAnalytics}
              range={range}
              t={t}
            />
          )}
          {activeTab === 'monthly' && <MonthlyTab reports={reports} expensesByCategory={expensesByCategory} t={t} />}
          {activeTab === 'inventory' && <InventoryTab reports={reports} leastProfitableItems={leastProfitableItems} leastProfitableSuppliers={leastProfitableSuppliers} inventoryAging={inventoryAging} t={t} />}
          {activeTab === 'financial' && <FinancialTab reports={reports} expensesByCategory={expensesByCategory} t={t} />}
          {activeTab === 'customers' && <CustomersTab reports={reports} t={t} />}
          {activeTab === 'employees' && (
            <EmployeesTab 
              employeeSales={employeeSales} 
              startDate={range.startDate} 
              endDate={range.endDate} 
              token={token} 
            />
          )}
          {activeTab === 'activity' && <ActivityTab reports={reports} t={t} />}
        </>
      )}
    </div>
  );
};

export default ReportsPage;
